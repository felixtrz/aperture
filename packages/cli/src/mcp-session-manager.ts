import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { APERTURE_REFERENCE_TOOL_CONTRACT } from "./reference.js";
import { callReferenceTool } from "./tools/reference.js";
import { callApertureTool } from "./devtools-client.js";
import {
  readApertureDevLogs,
  readApertureDevStatus,
  startApertureDevSession,
  stopApertureDevSession,
} from "./dev-session.js";
import { apertureRuntimeDir } from "./session.js";
import { readPngDimensions, readPngSamples } from "./tools/png-readback.js";
import {
  createApertureRenderSession,
  type ApertureRenderSession,
} from "./render/driver.js";
import { ApertureCliError } from "./errors.js";
import { preflightApertureSnapshotBundle } from "./headless/bundle.js";
import {
  createHeadlessSessionControllerFromConfig,
  type HeadlessSessionController,
  type HeadlessSessionLogEntry,
} from "./headless/session-controller.js";
import type { NodeAssetLoaderMode } from "./headless/node-asset-loader.js";

export type McpTarget = "headed" | "headless";

export interface SharedMcpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties?: Record<string, unknown>;
    readonly additionalProperties?: boolean;
  };
}

export interface ApertureMcpSessionManagerOptions {
  readonly cwd: string;
  readonly entryPoint?: string;
}

interface HeadlessSlot {
  readonly configFile: string;
  readonly root: string;
  readonly controller: HeadlessSessionController;
  readonly logs: RingBuffer<HeadlessSessionLogEntry>;
  readonly loggedDiagnostics: Set<string>;
}

interface HeadedSlot {
  readonly root: string;
}

interface CallInput {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export class ApertureMcpSessionManager {
  readonly #cwd: string;
  readonly #entryPoint: string;
  #headed: HeadedSlot | null = null;
  #headless: HeadlessSlot | null = null;
  // Warm render slot (#61): the browser + Xvfb boot (~4-5s) dominates every
  // on-demand render, so frame_capture reuses one session across calls and
  // only the first capture pays it. Released on app_stop.
  #renderSession: Promise<ApertureRenderSession> | null = null;

  constructor(options: ApertureMcpSessionManagerOptions) {
    this.#cwd = path.resolve(options.cwd);
    this.#entryPoint = options.entryPoint ?? process.argv[1] ?? "aperture";
  }

  #warmRenderSession(): Promise<ApertureRenderSession> {
    this.#renderSession ??= createApertureRenderSession({
      displayWidth: 1920,
      displayHeight: 1080,
    });
    return this.#renderSession;
  }

  async #disposeRenderSession(): Promise<void> {
    const pending = this.#renderSession;
    this.#renderSession = null;
    if (pending !== null) {
      await pending.then(
        (session) => session.dispose(),
        () => undefined,
      );
    }
  }

  toolDefinitions(): readonly SharedMcpToolDefinition[] {
    return [
      tool("app_status", "Read headed/headless session status.", {
        target: targetSchema(),
        waitUntilReady: { type: "boolean" },
        timeoutMs: { type: "number" },
        appRoot: { type: "string" },
      }),
      tool("app_start", "Start a headed or headless Aperture session.", {
        target: targetSchema(),
        appRoot: { type: "string" },
        config: { type: "string" },
        root: { type: "string" },
        publicDir: { type: "string" },
        seed: { type: "number" },
        assetMode: { enum: ["placeholder", "hybrid", "strict"] },
        allowHttpAssets: { type: "boolean" },
        decoderAssetsDir: { type: "string" },
        determinism: { enum: ["off", "warn", "error"] },
        port: { type: "number" },
        headless: { type: "boolean" },
        gpu: { enum: ["auto", "hardware", "software"] },
      }),
      tool("app_stop", "Stop a headed or headless Aperture session.", {
        target: targetSchema(),
        appRoot: { type: "string" },
      }),
      tool("app_reset", "Reload or rebuild a headed/headless session.", {
        target: targetSchema(),
        appRoot: { type: "string" },
        seed: { type: "number" },
        waitUntilReady: { type: "boolean" },
        timeoutMs: { type: "number" },
      }),
      tool("ecs_step", "Advance authoritative simulation.", sharedStepSchema()),
      tool("ecs_find_entities", "Find ECS entities.", sharedTargetSchema()),
      tool(
        "ecs_get_entity",
        "Read one ECS entity summary.",
        sharedTargetSchema(),
      ),
      tool("ecs_query", "Run a structured ECS query.", sharedTargetSchema()),
      tool(
        "ecs_get_component_schema",
        "Inspect an ECS component schema.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_snapshot",
        "Capture an ECS summary snapshot.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_diff",
        "Diff against the previous ECS snapshot.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_list_systems",
        "List systems and schedule metadata.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_pause",
        "Pause headed simulation or no-op a headless slot.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_resume",
        "Resume headed simulation or no-op a headless slot.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_set_component_field",
        "Mutate an allowlisted ECS field.",
        sharedTargetSchema(),
      ),
      tool(
        "ecs_get_hierarchy",
        "Read derived ECS hierarchy.",
        sharedTargetSchema(),
      ),
      tool(
        "asset_list",
        "List configured assets and readiness.",
        sharedTargetSchema(),
      ),
      tool("resource_get", "Read initialized resources.", {
        ...sharedTargetSchema(),
        id: { type: "string" },
      }),
      tool("resource_set", "Patch initialized resources.", {
        ...sharedTargetSchema(),
        id: { type: "string" },
        values: { type: "object" },
      }),
      tool(
        "input_inject",
        "Apply semantic input to a session.",
        sharedTargetSchema(),
      ),
      tool(
        "input_get_state",
        "Read generated input state.",
        sharedTargetSchema(),
      ),
      tool("input_reset", "Clear generated input state.", sharedTargetSchema()),
      tool("camera_list", "List ECS cameras.", sharedTargetSchema()),
      tool("camera_get", "Read ECS camera state.", sharedTargetSchema()),
      tool(
        "camera_save",
        "Save camera state in the session slot.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_restore",
        "Restore camera state in the session slot.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_create_agent",
        "Create or reuse an ECS agent camera.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_set_transform",
        "Set ECS camera transform.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_look_at",
        "Aim ECS camera at a target.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_orbit",
        "Orbit ECS camera around a target.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_fit_entity",
        "Fit ECS camera to an entity or target.",
        sharedTargetSchema(),
      ),
      tool(
        "camera_use_agent_view",
        "Promote a camera to primary render view.",
        sharedTargetSchema(),
      ),
      tool(
        "frame_capture",
        "Capture the current frame as a PNG with metadata. width/height set the render size on the headless target; the headed target captures the live canvas at its natural size (a diagnostic reports any mismatch).",
        {
          target: targetSchema(),
          appRoot: { type: "string" },
          out: { type: "string" },
          bundleOut: { type: "string" },
          includeData: { type: "boolean" },
          width: { type: "number" },
          height: { type: "number" },
          allowPlaceholders: { type: "boolean" },
          waitUntilReady: { type: "boolean" },
          timeoutMs: { type: "number" },
          region: { enum: ["canvas", "viewport"] },
          samples: { type: "array" },
        },
      ),
      tool("logs_read", "Read recent headed/headless logs.", {
        target: targetSchema(),
        appRoot: { type: "string" },
        lines: { type: "number" },
      }),
      tool(
        "render_bundle",
        "Export the current headless frame as a render bundle.",
        {
          target: targetSchema(),
          out: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
          digest: { type: "boolean" },
          includeBundle: { type: "boolean" },
        },
      ),
      tool("session_snapshot_save", "Export a headless SessionSnapshot.", {
        target: targetSchema(),
        out: { type: "string" },
      }),
      tool("session_snapshot_restore", "Restore a headless SessionSnapshot.", {
        target: targetSchema(),
        path: { type: "string" },
      }),
      tool(
        "determinism_report",
        "Read headless determinism diagnostics and digests.",
        {
          target: targetSchema(),
        },
      ),
      tool(
        "command_dispatch",
        "Post an app command onto the headless command bus for systems to drain on the next step.",
        {
          target: targetSchema(),
          channel: { type: "string" },
          payload: {},
        },
      ),
      ...APERTURE_REFERENCE_TOOL_CONTRACT.map((definition) =>
        tool(
          definition.name,
          definition.description,
          definition.properties ?? {},
        ),
      ),
    ];
  }

  async call(input: CallInput): Promise<unknown> {
    if (input.name.startsWith("reference_")) {
      return callReferenceTool(this.#cwd, input.name, input.args);
    }

    const result = finalizeMcpResult(await this.#callShared(input));
    this.#recordHeadlessDiagnostics(input.name, result);
    return result;
  }

  async #callShared(input: CallInput): Promise<unknown> {
    try {
      return await this.#dispatch(input);
    } catch (error: unknown) {
      return diagnosticResult(
        responseTarget(input.args),
        errorCode(error),
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async #dispatch(input: CallInput): Promise<unknown> {
    switch (input.name) {
      case "app_status":
        return this.#appStatus(input.args);
      case "app_start":
        return this.#appStart(input.args);
      case "app_stop":
        return this.#appStop(input.args);
      case "app_reset":
        return this.#appReset(input.args);
      case "frame_capture":
        return this.#frameCapture(input.args);
      case "logs_read":
        return this.#logsRead(input.args);
      case "render_bundle":
        return this.#renderBundle(input.args);
      case "session_snapshot_save":
        return this.#sessionSnapshotSave(input.args);
      case "session_snapshot_restore":
        return this.#sessionSnapshotRestore(input.args);
      case "determinism_report":
        return this.#determinismReport(input.args);
      case "command_dispatch":
        return this.#commandDispatch(input.args);
      case "input_inject":
        return this.#inputInject(input.args);
      default:
        if (isSharedRuntimeTool(input.name)) {
          return this.#sharedRuntimeTool(input.name, input.args);
        }
    }

    return {
      ok: false,
      target: responseTarget(input.args),
      mode: responseTarget(input.args),
      diagnostics: [
        {
          code: "aperture.mcp.toolUnsupported",
          message: `Unsupported Aperture MCP tool '${input.name}'.`,
        },
      ],
    };
  }

  #recordHeadlessDiagnostics(toolName: string, result: unknown): void {
    if (toolName === "logs_read" || !isRecord(result)) {
      return;
    }

    const target = result["target"];
    if (target !== "headless" || this.#headless === null) {
      return;
    }

    this.#recordDiagnosticsFromValue(toolName, result);
    this.#recordDiagnosticsFromValue(
      toolName,
      this.#headless.controller.status(),
    );
  }

  #recordDiagnosticsFromValue(source: string, value: unknown): void {
    if (this.#headless === null) {
      return;
    }

    for (const diagnostic of diagnosticsFrom(value)) {
      if (!isRecord(diagnostic)) {
        continue;
      }

      const code = stringValue(diagnostic["code"]);
      const message =
        stringValue(diagnostic["message"]) ?? "Aperture diagnostic.";
      const key = `${source}:${code ?? ""}:${message}:${JSON.stringify(
        diagnostic["data"] ?? null,
      )}`;
      if (this.#headless.loggedDiagnostics.has(key)) {
        continue;
      }

      this.#headless.loggedDiagnostics.add(key);
      this.#headless.logs.push({
        time: new Date().toISOString(),
        level: diagnosticLogLevel(diagnostic["severity"]),
        source,
        ...(code === undefined ? {} : { code }),
        message,
        data: diagnostic,
      });
    }
  }

  async #appStatus(args: Record<string, unknown>): Promise<unknown> {
    const target = optionalTarget(args);

    if (target === "headed") {
      return this.#headedStatus(args);
    }

    if (target === "headless") {
      return this.#headlessStatus();
    }

    return {
      ok: true,
      target: "all",
      headed: await this.#headedStatus(args),
      headless: this.#headlessStatus(),
    };
  }

  async #headedStatus(args: Record<string, unknown>): Promise<unknown> {
    const appRoot = this.#headedAppRoot(args);
    if (args["waitUntilReady"] === true) {
      const ready = await callApertureTool({
        cwd: appRoot,
        name: "browser_wait_for_webgpu",
        arguments: {
          timeoutMs: numberArg(args, "timeoutMs") ?? 30_000,
        },
        keepBrowserConnection: true,
      });
      return normalizeResult("headed", ready);
    }

    const status = await readApertureDevStatus(appRoot);
    return {
      ok: true,
      target: "headed",
      mode: "headed",
      running:
        status.session !== null &&
        status.daemonAlive &&
        status.serverAlive &&
        status.browserAlive,
      status,
    };
  }

  #headlessStatus(): unknown {
    if (this.#headless === null) {
      return {
        ok: true,
        target: "headless",
        mode: "headless",
        running: false,
      };
    }

    return {
      ok: true,
      target: "headless",
      mode: "headless",
      running: true,
      status: this.#headless.controller.status(),
    };
  }

  async #appStart(args: Record<string, unknown>): Promise<unknown> {
    const target = requiredTarget(args, "app_start");
    return target === "headed"
      ? this.#startHeaded(args)
      : this.#startHeadless(args);
  }

  async #startHeaded(args: Record<string, unknown>): Promise<unknown> {
    const appRoot = appRootArg(this.#cwd, args);
    if (this.#headed !== null && this.#headed.root !== appRoot) {
      await stopApertureDevSession({ cwd: this.#headed.root });
      this.#headed = null;
    }

    const port = numberArg(args, "port");
    const gpu = stringArg(args, "gpu") as
      | "auto"
      | "hardware"
      | "software"
      | undefined;
    const report = await startApertureDevSession({
      cwd: appRoot,
      entryPoint: this.#entryPoint,
      open: args["headless"] === false,
      headless: args["headless"] !== false,
      ...(port === undefined ? {} : { port }),
      ...(gpu === undefined ? {} : { gpu }),
    });
    this.#headed = { root: appRoot };

    return {
      ok: true,
      target: "headed",
      mode: "headed",
      reused: report.reused,
      session: report.session,
    };
  }

  async #startHeadless(args: Record<string, unknown>): Promise<unknown> {
    const config = stringArg(args, "config");
    if (config === undefined) {
      return diagnosticResult(
        "headless",
        "aperture.mcp.configMissing",
        "app_start target=headless requires config.",
      );
    }

    const root = path.resolve(
      this.#cwd,
      stringArg(args, "root") ?? path.dirname(config),
    );
    const logs = new RingBuffer<HeadlessSessionLogEntry>(200);
    const controller = await createHeadlessSessionControllerFromConfig({
      configFile: path.resolve(this.#cwd, config),
      root,
      publicDir: stringArg(args, "publicDir") ?? "public",
      ...(stringArg(args, "decoderAssetsDir") === undefined
        ? {}
        : {
            decoderAssetsDir: path.resolve(
              this.#cwd,
              stringArg(args, "decoderAssetsDir") ?? "",
            ),
          }),
      allowHttpAssets: args["allowHttpAssets"] === true,
      assetMode: nodeAssetLoaderMode(args["assetMode"]),
      determinism: determinismMode(args["determinism"]),
      seed: numberArg(args, "seed") ?? 0,
      log(entry) {
        logs.push(entry);
      },
    });

    const previous = this.#headless;
    this.#headless = {
      configFile: path.resolve(this.#cwd, config),
      root,
      controller,
      logs,
      loggedDiagnostics: new Set(),
    };
    previous?.controller.dispose();

    return {
      ok: true,
      target: "headless",
      mode: "headless",
      status: controller.compactStatus(),
    };
  }

  async #appStop(args: Record<string, unknown>): Promise<unknown> {
    const target = requiredTarget(args, "app_stop");
    if (target === "headed") {
      const appRoot = this.#headedAppRoot(args);
      const report = await stopApertureDevSession({ cwd: appRoot });
      if (this.#headed?.root === appRoot) {
        this.#headed = null;
      }
      return { ok: true, target, mode: target, ...report };
    }

    const previous = this.#headless;
    const hadSession = previous !== null;
    this.#headless = null;
    previous?.controller.dispose();
    await this.#disposeRenderSession();
    return { ok: true, target, mode: target, hadSession, stopped: hadSession };
  }

  async #appReset(args: Record<string, unknown>): Promise<unknown> {
    const target = resolveTarget(args, this.#headless !== null);
    if (target === "headed") {
      const appRoot = this.#headedAppRoot(args);
      const result = await callApertureTool({
        cwd: appRoot,
        name: "browser_reload",
        arguments: {},
        keepBrowserConnection: true,
      });
      if (args["waitUntilReady"] === true) {
        const ready = await callApertureTool({
          cwd: appRoot,
          name: "browser_wait_for_webgpu",
          arguments: { timeoutMs: numberArg(args, "timeoutMs") ?? 30_000 },
          keepBrowserConnection: true,
        });
        if (isRecord(ready) && ready["ok"] === false) {
          return normalizeResult("headed", ready);
        }
      }
      return normalizeResult("headed", result);
    }

    const slot = this.#requireHeadless();
    return {
      ok: true,
      target,
      mode: target,
      result: await slot.controller.reset({
        ...(numberArg(args, "seed") === undefined
          ? {}
          : { seed: numberArg(args, "seed") as number }),
      }),
    };
  }

  async #sharedRuntimeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const target = resolveTarget(args, this.#headless !== null);
    const toolArgs = withoutRoutingArgs(args);

    if (target === "headed") {
      const appRoot = this.#headedAppRoot(args);
      if (name === "ecs_step" && numberArg(args, "frames") !== undefined) {
        let result: unknown = null;
        const frames = Math.max(1, Math.floor(numberArg(args, "frames") ?? 1));
        for (let index = 0; index < frames; index += 1) {
          result = await callApertureTool({
            cwd: appRoot,
            name,
            arguments: toolArgs,
            keepBrowserConnection: true,
          });
        }
        return normalizeResult(target, result);
      }

      const result = await callApertureTool({
        cwd: appRoot,
        name,
        arguments: toolArgs,
        keepBrowserConnection: true,
      });
      return name === "ecs_list_systems"
        ? normalizeSystemsResult(target, result)
        : normalizeResult(target, result);
    }

    const slot = this.#requireHeadless();
    const result =
      name === "ecs_step"
        ? { ok: true, result: slot.controller.step(toolArgs) }
        : slot.controller.callTool({ name, arguments: toolArgs });

    return name === "ecs_list_systems"
      ? normalizeSystemsResult(target, result)
      : normalizeResult(target, result);
  }

  async #inputInject(args: Record<string, unknown>): Promise<unknown> {
    const target = resolveTarget(args, this.#headless !== null);
    const payload = withoutRoutingArgs(args);
    if (target === "headless") {
      const slot = this.#requireHeadless();
      const results: unknown[] = [];

      if (isRecord(payload["pointer"])) {
        results.push(slot.controller.inject({ pointer: payload["pointer"] }));
      }

      results.push(
        ...semanticActionCalls(payload).map((action) =>
          slot.controller.callTool({
            name: "input_action_set",
            arguments: action,
          }),
        ),
      );

      if (isRecord(payload["gamepad"])) {
        results.push(
          slot.controller.callTool({
            name: "input_gamepad_set",
            arguments: payload["gamepad"],
          }),
        );
      }

      return {
        ok: results.every(toolCallOk),
        target,
        mode: target,
        result: { results },
        diagnostics: results.flatMap(toolCallDiagnostics),
      };
    }

    const appRoot = this.#headedAppRoot(args);
    const results: unknown[] = [];
    const pointer = isRecord(payload["pointer"]) ? payload["pointer"] : null;
    if (pointer !== null) {
      const position = tuple2Arg(pointer["position"]);
      if (position !== null) {
        results.push(
          await callApertureTool({
            cwd: appRoot,
            name: "input_pointer_move",
            arguments: { x: position[0], y: position[1] },
            keepBrowserConnection: true,
          }),
        );
      }

      if (typeof pointer["pressed"] === "boolean") {
        results.push(
          await callApertureTool({
            cwd: appRoot,
            name: "input_pointer_set",
            arguments:
              position === null
                ? { pressed: pointer["pressed"] }
                : {
                    x: position[0],
                    y: position[1],
                    pressed: pointer["pressed"],
                  },
            keepBrowserConnection: true,
          }),
        );
      }
    }

    for (const actionArgs of semanticActionCalls(payload)) {
      results.push(
        await callApertureTool({
          cwd: appRoot,
          name: "input_action_set",
          arguments: actionArgs,
          keepBrowserConnection: true,
        }),
      );
    }

    if (isRecord(payload["gamepad"])) {
      results.push(
        await callApertureTool({
          cwd: appRoot,
          name: "input_gamepad_set",
          arguments: payload["gamepad"],
          keepBrowserConnection: true,
        }),
      );
    }

    return {
      ok: results.every(toolCallOk),
      target,
      mode: target,
      result: { results },
      diagnostics: results.flatMap(toolCallDiagnostics),
    };
  }

  async #frameCapture(args: Record<string, unknown>): Promise<unknown> {
    const target = resolveTarget(args, this.#headless !== null);
    return target === "headed"
      ? this.#headedFrameCapture(args)
      : this.#headlessFrameCapture(args);
  }

  async #headedFrameCapture(args: Record<string, unknown>): Promise<unknown> {
    const appRoot = this.#headedAppRoot(args);
    if (args["waitUntilReady"] === true) {
      const ready = await callApertureTool({
        cwd: appRoot,
        name: "browser_wait_for_webgpu",
        arguments: { timeoutMs: numberArg(args, "timeoutMs") ?? 30_000 },
        keepBrowserConnection: true,
      });
      if (isRecord(ready) && ready["ok"] === false) {
        return normalizeResult("headed", ready);
      }
    }

    const screenshot = await callApertureTool({
      cwd: appRoot,
      name: "browser_screenshot",
      arguments: {
        outputPath: stringArg(args, "out"),
        includeData: args["includeData"] === true,
        region: stringArg(args, "region") ?? "canvas",
      },
      keepBrowserConnection: true,
    });
    const canvas = await callApertureTool({
      cwd: appRoot,
      name: "browser_canvas_status",
      arguments: {},
      keepBrowserConnection: true,
    });
    const capture = frameCaptureMetadataFromCanvasStatus(canvas);
    const png = await imageBufferFromCaptureResult(screenshot);
    const samples =
      png !== null && Array.isArray(args["samples"])
        ? readPngSamples(png, { samples: args["samples"] })
        : undefined;
    const dimensions = png === null ? undefined : readPngDimensions(png);

    return {
      ...imageResultFields(screenshot),
      target: "headed",
      mode: "headed",
      source: "live-browser-canvas",
      frame: readFrameFromCanvasStatus(canvas),
      pngPath: isRecord(screenshot) ? screenshot["path"] : undefined,
      dimensions,
      canvas: capture.canvas,
      viewport: capture.viewport,
      renderTarget: capture.renderTarget,
      ...(samples === undefined ? {} : { samples }),
      diagnostics: [
        ...diagnosticsFrom(screenshot, canvas),
        // The headed target captures the LIVE canvas at its natural size —
        // say so explicitly instead of silently ignoring width/height (#70).
        ...headedCaptureSizeDiagnostics(args, dimensions),
      ],
    };
  }

  async #headlessFrameCapture(args: Record<string, unknown>): Promise<unknown> {
    const slot = this.#requireHeadless();
    const artifacts = artifactPaths(slot.root, args, "headless-frame");
    const bundleResult = await slot.controller.createBundle({
      out: artifacts.bundle,
      ...(numberArg(args, "width") === undefined
        ? {}
        : { width: numberArg(args, "width") as number }),
      ...(numberArg(args, "height") === undefined
        ? {}
        : { height: numberArg(args, "height") as number }),
      createdBy: "aperture mcp frame_capture",
    });
    const bundle = isRecord(bundleResult) ? bundleResult["bundle"] : null;
    const renderTarget = isRecord(bundleResult)
      ? bundleResult["renderTarget"]
      : null;
    const width = renderTargetDimension(
      renderTarget,
      "width",
      numberArg(args, "width") ?? 960,
    );
    const height = renderTargetDimension(
      renderTarget,
      "height",
      numberArg(args, "height") ?? 640,
    );
    const allowPlaceholders = args["allowPlaceholders"] === true;
    const preflight = preflightApertureSnapshotBundle(bundle, {
      allowPlaceholders,
    });
    const preflightDiagnostics = bundlePreflightDiagnostics(
      preflight,
      allowPlaceholders,
    );

    if (!preflight.ok) {
      return {
        ok: false,
        target: "headless",
        mode: "headless",
        source: "render-bundle",
        bundlePath: isRecord(bundleResult) ? bundleResult["path"] : undefined,
        renderTarget,
        assetProvenance: isRecord(bundleResult)
          ? bundleResult["assetProvenance"]
          : undefined,
        diagnostics: preflightDiagnostics,
      };
    }

    const session = await this.#warmRenderSession();
    const rendered = await session
      .render({ bundle, width, height })
      .catch(async (error: unknown) => {
        // A dead browser poisons the warm slot; drop it so the next capture
        // boots a fresh one instead of failing forever.
        await this.#disposeRenderSession();
        throw error;
      });
    const pngPath = artifacts.png;
    await mkdir(path.dirname(pngPath), { recursive: true });
    await writeFile(pngPath, rendered.png);
    const samples = Array.isArray(args["samples"])
      ? readPngSamples(rendered.png, { samples: args["samples"] })
      : undefined;

    return {
      ok: true,
      target: "headless",
      mode: "headless",
      source: "render-bundle",
      frame: rendered.frame,
      pngPath,
      bundlePath: isRecord(bundleResult) ? bundleResult["path"] : undefined,
      mimeType: "image/png",
      encoding: "base64",
      byteLength: rendered.png.byteLength,
      dimensions: readPngDimensions(rendered.png),
      canvas: headlessCanvasMetadata(width, height),
      viewport: headlessCanvasMetadata(width, height),
      renderTarget,
      webgpu: rendered.metadata.webgpu,
      assetProvenance: isRecord(bundleResult)
        ? bundleResult["assetProvenance"]
        : undefined,
      ...(samples === undefined ? {} : { samples }),
      // Mirror the headed envelope (#70): return the PNG inline (an MCP image
      // block) unless the caller redirected the capture to an explicit `out`
      // file; includeData still forces both.
      ...(args["includeData"] === true || stringArg(args, "out") === undefined
        ? { data: rendered.png.toString("base64") }
        : {}),
      ...(args["includeData"] === true ? { includeData: true } : {}),
      diagnostics: preflightDiagnostics,
    };
  }

  async #logsRead(args: Record<string, unknown>): Promise<unknown> {
    const target = resolveTarget(args, this.#headless !== null);
    const lines = Math.max(1, Math.floor(numberArg(args, "lines") ?? 80));
    if (target === "headed") {
      const report = await readApertureDevLogs({
        cwd: this.#headedAppRoot(args),
        lines,
      });
      return { ok: true, target, mode: target, logs: report.logs };
    }

    return {
      ok: true,
      target,
      mode: target,
      entries: this.#headless?.logs.values(lines) ?? [],
    };
  }

  async #renderBundle(args: Record<string, unknown>): Promise<unknown> {
    requiredHeadlessTarget(args, "render_bundle");
    const slot = this.#requireHeadless();
    const out = stringArg(args, "out");
    if (out === undefined) {
      return diagnosticResult(
        "headless",
        "aperture.mcp.outputMissing",
        "render_bundle requires out.",
      );
    }
    const result = await slot.controller.createBundle({
      out: path.resolve(this.#cwd, out),
      ...(numberArg(args, "width") === undefined
        ? {}
        : { width: numberArg(args, "width") as number }),
      ...(numberArg(args, "height") === undefined
        ? {}
        : { height: numberArg(args, "height") as number }),
      digest: args["digest"] === true,
      createdBy: "aperture mcp render_bundle",
    });
    return normalizeResult(
      "headless",
      args["includeBundle"] === true ? result : omitBundle(result),
    );
  }

  async #sessionSnapshotSave(args: Record<string, unknown>): Promise<unknown> {
    requiredHeadlessTarget(args, "session_snapshot_save");
    const out = stringArg(args, "out");
    if (out === undefined) {
      return diagnosticResult(
        "headless",
        "aperture.mcp.outputMissing",
        "session_snapshot_save requires out.",
      );
    }
    return normalizeResult(
      "headless",
      await this.#requireHeadless().controller.saveSessionSnapshot({
        out: path.resolve(this.#cwd, out),
      }),
    );
  }

  async #sessionSnapshotRestore(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    requiredHeadlessTarget(args, "session_snapshot_restore");
    const snapshotPath = stringArg(args, "path");
    if (snapshotPath === undefined) {
      return diagnosticResult(
        "headless",
        "aperture.mcp.snapshotMissing",
        "session_snapshot_restore requires path.",
      );
    }
    const snapshot = JSON.parse(
      await readFile(path.resolve(this.#cwd, snapshotPath), "utf8"),
    ) as never;
    return normalizeResult(
      "headless",
      await this.#requireHeadless().controller.restoreSessionSnapshot({
        snapshot,
      }),
    );
  }

  #determinismReport(args: Record<string, unknown>): unknown {
    requiredHeadlessTarget(args, "determinism_report");
    return normalizeResult(
      "headless",
      this.#requireHeadless().controller.determinismReport(),
    );
  }

  #commandDispatch(args: Record<string, unknown>): unknown {
    requiredHeadlessTarget(args, "command_dispatch");
    const channel = stringArg(args, "channel");
    if (channel === undefined) {
      return diagnosticResult(
        "headless",
        "aperture.mcp.commandMissing",
        "command_dispatch requires a non-empty channel.",
      );
    }
    return normalizeResult(
      "headless",
      this.#requireHeadless().controller.dispatchCommand({
        channel,
        payload: args["payload"],
      }),
    );
  }

  #requireHeadless(): HeadlessSlot {
    if (this.#headless === null) {
      throw new ApertureCliError(
        "aperture.mcp.headlessSessionMissing",
        "No headless session is running. Call app_start with target: 'headless' first.",
      );
    }
    return this.#headless;
  }

  #headedAppRoot(args: Record<string, unknown>): string {
    const explicit = stringArg(args, "appRoot");
    if (explicit !== undefined) {
      return path.resolve(this.#cwd, explicit);
    }
    return this.#headed?.root ?? this.#cwd;
  }
}

class RingBuffer<T> {
  readonly #capacity: number;
  readonly #items: T[] = [];

  constructor(capacity: number) {
    this.#capacity = Math.max(1, capacity);
  }

  push(item: T): void {
    this.#items.push(item);
    while (this.#items.length > this.#capacity) {
      this.#items.shift();
    }
  }

  values(limit = this.#capacity): readonly T[] {
    return this.#items.slice(Math.max(0, this.#items.length - limit));
  }
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
): SharedMcpToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      additionalProperties: true,
    },
  };
}

function sharedTargetSchema(): Record<string, unknown> {
  return { target: targetSchema(), appRoot: { type: "string" } };
}

function sharedStepSchema(): Record<string, unknown> {
  return {
    target: targetSchema(),
    appRoot: { type: "string" },
    frames: { type: "number" },
    delta: { type: "number" },
    time: { type: "number" },
    digest: { type: "boolean" },
    extract: { type: "boolean" },
  };
}

function targetSchema(): Record<string, unknown> {
  return { enum: ["headed", "headless"] };
}

function isSharedRuntimeTool(name: string): boolean {
  return (
    name.startsWith("ecs_") ||
    name.startsWith("camera_") ||
    name === "asset_list" ||
    name === "resource_get" ||
    name === "resource_set" ||
    name === "input_get_state" ||
    name === "input_reset" ||
    name === "input_action_set" ||
    name === "input_gamepad_set"
  );
}

function optionalTarget(args: Record<string, unknown>): McpTarget | null {
  const target = args["target"];
  return target === "headed" || target === "headless" ? target : null;
}

function requiredTarget(
  args: Record<string, unknown>,
  toolName: string,
): McpTarget {
  const target = optionalTarget(args);
  if (target !== null) {
    return target;
  }
  throw new ApertureCliError(
    "aperture.mcp.targetMissing",
    `${toolName} requires target: 'headed' or 'headless'.`,
  );
}

function requiredHeadlessTarget(
  args: Record<string, unknown>,
  toolName: string,
): void {
  const target = optionalTarget(args);
  if (target !== null && target !== "headless") {
    throw new ApertureCliError(
      "aperture.mcp.invalidTarget",
      `${toolName} only supports target: 'headless'.`,
    );
  }
}

function resolveTarget(
  args: Record<string, unknown>,
  headlessRunning: boolean,
): McpTarget {
  return optionalTarget(args) ?? (headlessRunning ? "headless" : "headed");
}

function withoutRoutingArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const { appRoot: _appRoot, target: _target, ...rest } = args;
  return rest;
}

function normalizeResult(target: McpTarget, value: unknown): unknown {
  if (!isRecord(value)) {
    return { ok: true, target, mode: target, result: value };
  }
  return {
    target,
    mode: target,
    ...value,
    ok: typeof value["ok"] === "boolean" ? value["ok"] : true,
  };
}

function finalizeMcpResult(value: unknown): unknown {
  if (!isRecord(value)) {
    return {
      ok: true,
      target: "all",
      mode: "all",
      result: value,
      diagnostics: [],
    };
  }

  const target = stringValue(value["target"]);
  const mode = stringValue(value["mode"]) ?? target;
  const diagnostics = diagnosticsFrom(value);
  const frame = inferFrame(value);

  return {
    ...value,
    ok: typeof value["ok"] === "boolean" ? value["ok"] : true,
    ...(target === undefined ? {} : { target }),
    ...(mode === undefined ? {} : { mode }),
    ...(Object.prototype.hasOwnProperty.call(value, "diagnostics")
      ? {}
      : { diagnostics }),
    ...(Object.prototype.hasOwnProperty.call(value, "frame") ||
    frame === undefined
      ? {}
      : { frame }),
  };
}

function inferFrame(value: Record<string, unknown>): number | undefined {
  const direct = numberValue(value["frame"]) ?? numberValue(value["nextFrame"]);
  if (direct !== undefined) {
    return direct;
  }

  const result = isRecord(value["result"]) ? value["result"] : null;
  const resultFrame =
    result === null
      ? undefined
      : (numberValue(result["frame"]) ?? numberValue(result["nextFrame"]));
  if (resultFrame !== undefined) {
    return resultFrame;
  }

  const status = isRecord(value["status"]) ? value["status"] : null;
  return status === null
    ? undefined
    : (numberValue(status["frame"]) ??
        numberValue(status["nextFrame"]) ??
        numberValue(status["lastFrame"]));
}

function normalizeSystemsResult(target: McpTarget, value: unknown): unknown {
  const normalized = normalizeResult(target, value);
  if (!isRecord(normalized)) {
    return normalized;
  }

  if (Array.isArray(normalized["systems"])) {
    return normalized;
  }

  const result = isRecord(normalized["result"]) ? normalized["result"] : null;
  if (!Array.isArray(result?.["systems"])) {
    return normalized;
  }

  const { result: _result, ...rest } = normalized;
  return {
    ...rest,
    systems: result["systems"],
  };
}

function diagnosticResult(
  target: string,
  code: string,
  message: string,
): unknown {
  return {
    ok: false,
    target,
    mode: target,
    diagnostics: [{ code, message }],
  };
}

function responseTarget(args: Record<string, unknown>): string {
  return optionalTarget(args) ?? "all";
}

function errorCode(error: unknown): string {
  return error instanceof ApertureCliError
    ? error.code
    : "aperture.mcp.toolFailed";
}

function appRootArg(cwd: string, args: Record<string, unknown>): string {
  return path.resolve(cwd, stringArg(args, "appRoot") ?? ".");
}

function stringArg(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function diagnosticLogLevel(value: unknown): HeadlessSessionLogEntry["level"] {
  return value === "error" || value === "warn" || value === "debug"
    ? value
    : value === "warning"
      ? "warn"
      : "info";
}

function nodeAssetLoaderMode(value: unknown): NodeAssetLoaderMode {
  // Hybrid by default, matching the headless CLI commands (#66).
  return value === "strict" || value === "hybrid" || value === "placeholder"
    ? value
    : "hybrid";
}

function determinismMode(value: unknown): "off" | "warn" | "error" {
  return value === "warn" || value === "error" ? value : "off";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diagnosticsFrom(...values: unknown[]): readonly unknown[] {
  return values.flatMap((value) =>
    isRecord(value) && Array.isArray(value["diagnostics"])
      ? value["diagnostics"]
      : isRecord(value) && isRecord(value["diagnostic"])
        ? [value["diagnostic"]]
        : [],
  );
}

function bundlePreflightDiagnostics(
  preflight: ReturnType<typeof preflightApertureSnapshotBundle>,
  allowPlaceholders: boolean,
): readonly Record<string, unknown>[] {
  const diagnostics: Record<string, unknown>[] = [];

  if (!preflight.ok) {
    diagnostics.push({
      code: "aperture.render.incompleteBundle",
      severity: "error",
      message: `Snapshot bundle is not render-complete: ${preflight.violations.join(
        "; ",
      )}.`,
      suggestedFix:
        "Re-export after assets are ready, or pass allowPlaceholders only when stubbed pixels are acceptable.",
      data: {
        violations: preflight.violations,
        missing: preflight.closure.missing,
        unready: preflight.closure.unready,
        placeholders: preflight.closure.placeholders,
      },
    });
  }

  if (allowPlaceholders && preflight.closure.placeholders.length > 0) {
    diagnostics.push({
      code: "aperture.render.placeholderAssets",
      severity: "warn",
      message: `Rendering ${preflight.closure.placeholders.length} placeholder asset(s); these pixels are stubbed, not real.`,
      data: {
        placeholders: preflight.closure.placeholders,
      },
    });
  }

  return diagnostics;
}

function semanticActionCalls(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const actions = isRecord(payload["actions"]) ? payload["actions"] : {};
  return Object.entries(actions).map(([action, value]) =>
    typeof value === "boolean"
      ? { action, pressed: value }
      : typeof value === "number"
        ? { action, value }
        : isRecord(value)
          ? { action, ...value }
          : { action, value },
  );
}

function tuple2Arg(value: unknown): readonly [number, number] | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    return [value[0], value[1]];
  }

  return null;
}

function toolCallOk(value: unknown): boolean {
  return !isRecord(value) || value["ok"] !== false;
}

function toolCallDiagnostics(value: unknown): unknown[] {
  return isRecord(value) && Array.isArray(value["diagnostics"])
    ? value["diagnostics"]
    : [];
}

function omitBundle(value: unknown): unknown {
  if (
    !isRecord(value) ||
    !Object.prototype.hasOwnProperty.call(value, "bundle")
  ) {
    return value;
  }

  const { bundle: _bundle, ...rest } = value;
  return rest;
}

function imageResultFields(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return { ok: false, diagnostics: [{ code: "aperture.mcp.captureFailed" }] };
  }
  return { ...value };
}

function headedCaptureSizeDiagnostics(
  args: Record<string, unknown>,
  dimensions: { readonly width: number; readonly height: number } | undefined,
): readonly Record<string, unknown>[] {
  const width = numberArg(args, "width");
  const height = numberArg(args, "height");
  if (width === undefined && height === undefined) {
    return [];
  }
  if (
    dimensions !== undefined &&
    (width === undefined || width === dimensions.width) &&
    (height === undefined || height === dimensions.height)
  ) {
    return [];
  }
  return [
    {
      code: "aperture.mcp.frameCaptureSizeIgnored",
      severity: "info",
      message:
        `frame_capture on the headed target captures the live canvas at its natural size` +
        `${dimensions === undefined ? "" : ` (${dimensions.width}x${dimensions.height})`}; ` +
        `the requested ${width ?? "?"}x${height ?? "?"} was not applied. ` +
        'Use target: "headless" when exact output dimensions are required.',
    },
  ];
}

async function imageBufferFromCaptureResult(
  value: unknown,
): Promise<Buffer | null> {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value["data"] === "string" && value["encoding"] === "base64") {
    return Buffer.from(value["data"], "base64");
  }

  if (typeof value["path"] === "string" && value["path"].length > 0) {
    return readFile(value["path"]);
  }

  return null;
}

function readFrameFromCanvasStatus(value: unknown): number | null {
  const status = isRecord(value) ? value["status"] : null;
  if (!isRecord(status)) {
    return null;
  }
  const renderTarget = status["renderTarget"];
  if (!isRecord(renderTarget)) {
    return null;
  }
  const frame = renderTarget["frame"];
  return typeof frame === "number" ? frame : null;
}

function frameCaptureMetadataFromCanvasStatus(value: unknown): {
  readonly canvas: unknown;
  readonly viewport: unknown;
  readonly renderTarget: unknown;
} {
  const status = isRecord(value) ? value["status"] : null;
  if (!isRecord(status)) {
    return { canvas: null, viewport: null, renderTarget: null };
  }

  const canvas = status["canvas"];
  return {
    canvas: isRecord(canvas) ? canvas : null,
    viewport: isRecord(canvas) ? viewportFromCanvas(canvas) : null,
    renderTarget: isRecord(status["renderTarget"])
      ? status["renderTarget"]
      : isRecord(canvas)
        ? renderTargetFromCanvas(canvas)
        : null,
  };
}

function viewportFromCanvas(
  canvas: Record<string, unknown>,
): Record<string, unknown> {
  const width =
    numberField(canvas, "displayWidth") ?? numberField(canvas, "width");
  const height =
    numberField(canvas, "displayHeight") ?? numberField(canvas, "height");
  const pixelRatio = numberField(canvas, "pixelRatio") ?? 1;
  return {
    width,
    height,
    displayWidth: width,
    displayHeight: height,
    pixelRatio,
    aspect:
      width !== undefined && height !== undefined && height !== 0
        ? width / height
        : null,
  };
}

function headlessCanvasMetadata(
  width: number,
  height: number,
): Record<string, unknown> {
  return {
    width,
    height,
    displayWidth: width,
    displayHeight: height,
    pixelRatio: 1,
    aspect: height === 0 ? null : width / height,
  };
}

function renderTargetFromCanvas(
  canvas: Record<string, unknown>,
): Record<string, unknown> | null {
  const width = numberField(canvas, "width");
  const height = numberField(canvas, "height");
  if (width === undefined || height === undefined) {
    return null;
  }

  return {
    width,
    height,
  };
}

function numberField(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof value[key] === "number" && Number.isFinite(value[key])
    ? value[key]
    : undefined;
}

function renderTargetDimension(
  value: unknown,
  key: "width" | "height",
  fallback: number,
): number {
  return isRecord(value) && typeof value[key] === "number"
    ? value[key]
    : fallback;
}

function artifactPaths(
  root: string,
  args: Record<string, unknown>,
  stem: string,
): { readonly png: string; readonly bundle: string } {
  const base = path.join(apertureRuntimeDir(root), "artifacts");
  const suffix = `${stem}-${Date.now()}`;
  return {
    png: path.resolve(
      root,
      stringArg(args, "out") ?? path.join(base, `${suffix}.png`),
    ),
    bundle: path.resolve(
      root,
      stringArg(args, "bundleOut") ?? path.join(base, `${suffix}.bundle.json`),
    ),
  };
}
