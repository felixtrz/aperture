import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createApertureHeadlessEcsDigest,
  createApertureHeadlessRunner,
  createApertureHeadlessStatusDigest,
  createApertureRenderSnapshotDigest,
  createApertureSessionSnapshot,
  restoreApertureHeadlessRunnerFromSessionSnapshot,
  type ApertureHeadlessStatus,
  type ApertureHeadlessRunner,
  type ApertureSessionSnapshot,
} from "@aperture-engine/app/headless";
import {
  callCameraTool,
  callInputDevtoolsTool,
  createAssetSummary,
  createGeneratedEntityToolBridge,
  type CameraToolState,
  type GeneratedDevtoolsToolResult,
  type GeneratedEntityToolBridge,
} from "@aperture-engine/app/headless-tools";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import type { ApertureDeterminismDiagnosticsMode } from "@aperture-engine/app/systems";
import type { ApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { RenderSnapshot } from "@aperture-engine/render";
import { ApertureCliError } from "../errors.js";
import { loadApertureHeadlessApp } from "./config-loader.js";
import {
  createNodeApertureAssetLoader,
  type NodeAssetLoaderMode,
} from "./node-asset-loader.js";
import {
  assertInjectActionsDriveButtons,
  createApertureHeadlessInjectEvents,
  parseApertureHeadlessInjectStep,
} from "./inject.js";
import {
  createApertureSnapshotBundle,
  renderBundleTargetFromRenderDefaults,
} from "./bundle.js";
import { syncAutoAspectCameras } from "./auto-aspect.js";

export const DEFAULT_HEADLESS_DELTA = 1 / 60;
export const DEFAULT_HEADLESS_RENDER_WIDTH = 960;
export const DEFAULT_HEADLESS_RENDER_HEIGHT = 640;

export interface HeadlessSessionControllerOptions {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly seed: number;
  readonly assetMode: NodeAssetLoaderMode;
  readonly root: string;
  readonly publicDir: string;
  readonly decoderAssetsDir?: string;
  readonly allowHttpAssets: boolean;
  readonly determinism: ApertureDeterminismDiagnosticsMode;
  /** Session render target; drives autoAspect cameras. Defaults to 960x640. */
  readonly renderWidth?: number;
  readonly renderHeight?: number;
  readonly log?: (entry: HeadlessSessionLogEntry) => void;
}

export interface HeadlessSessionControllerFromConfigOptions extends Omit<
  HeadlessSessionControllerOptions,
  "config" | "systems"
> {
  readonly configFile: string;
}

export interface HeadlessSessionLogEntry {
  readonly time: string;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly source: string;
  readonly code?: string;
  readonly message: string;
  readonly data?: unknown;
}

export interface HeadlessStepInput {
  readonly delta?: number;
  readonly time?: number;
  readonly frames?: number;
  readonly digest?: boolean;
  /**
   * When false, advance the simulation without running render extraction each
   * frame (finding F18). Counts in the result then reflect the last extracted
   * frame; call extract()/bundle to refresh render data. Defaults to true.
   */
  readonly extract?: boolean;
}

export interface HeadlessExtractInput {
  readonly frame?: number;
  readonly digest?: boolean;
}

export interface HeadlessBundleInput {
  readonly out: string;
  readonly width?: number;
  readonly height?: number;
  readonly digest?: boolean;
  readonly createdBy?: string;
}

export interface HeadlessResetInput {
  readonly seed?: number;
}

export interface HeadlessToolInput {
  readonly name: string;
  readonly arguments?: unknown;
}

export interface HeadlessSessionController {
  readonly runner: ApertureHeadlessRunner;
  readonly seed: number;
  compactStatus(): unknown;
  status(input?: { readonly digest?: boolean }): unknown;
  step(input?: HeadlessStepInput): unknown;
  extract(input?: HeadlessExtractInput): {
    readonly snapshot: RenderSnapshot;
    readonly result: unknown;
  };
  inject(input: unknown): GeneratedDevtoolsToolResult;
  dispatchCommand(input: {
    readonly channel: string;
    readonly payload?: unknown;
  }): unknown;
  reset(input?: HeadlessResetInput): Promise<unknown>;
  callTool(input: HeadlessToolInput): GeneratedDevtoolsToolResult;
  createBundle(input: HeadlessBundleInput): Promise<unknown>;
  saveSessionSnapshot(input: { readonly out: string }): Promise<unknown>;
  restoreSessionSnapshot(input: {
    readonly snapshot: ApertureSessionSnapshot;
  }): Promise<unknown>;
  determinismReport(): unknown;
  dispose(): void;
}

interface MutableControllerState {
  runner: ApertureHeadlessRunner;
  entityTools: GeneratedEntityToolBridge;
  savedCameraStates: Map<string, CameraToolState>;
  seed: number;
}

export async function createHeadlessSessionControllerFromConfig(
  options: HeadlessSessionControllerFromConfigOptions,
): Promise<HeadlessSessionController> {
  const loaded = await loadApertureHeadlessApp({
    configFile: options.configFile,
    root: options.root,
  });

  for (const diagnostic of loaded.diagnostics) {
    options.log?.({
      time: new Date().toISOString(),
      level: "warn",
      source: "config-loader",
      code: diagnostic.code,
      message: diagnostic.message,
      data: diagnostic,
    });
  }

  return createHeadlessSessionController({
    ...options,
    config: loaded.config,
    systems: loaded.systems,
  });
}

const MAX_SESSION_LOG_ENTRIES = 200;

export async function createHeadlessSessionController(
  options: HeadlessSessionControllerOptions,
): Promise<HeadlessSessionController> {
  // Session-local log ring so `logs_read` works against the warm headless
  // session itself (#71), not only through the MCP manager's buffer.
  const logEntries: HeadlessSessionLogEntry[] = [];
  const loggedDiagnostics = new Set<string>();

  function log(entry: HeadlessSessionLogEntry): void {
    logEntries.push(entry);
    if (logEntries.length > MAX_SESSION_LOG_ENTRIES) {
      logEntries.shift();
    }
    options.log?.(entry);
  }

  const sessionRenderWidth = positiveIntegerValue(
    options.renderWidth,
    DEFAULT_HEADLESS_RENDER_WIDTH,
  );
  const sessionRenderHeight = positiveIntegerValue(
    options.renderHeight,
    DEFAULT_HEADLESS_RENDER_HEIGHT,
  );

  const state: MutableControllerState = {
    runner: await bootRunner(options, options.seed),
    entityTools: undefined as unknown as GeneratedEntityToolBridge,
    savedCameraStates: new Map(),
    seed: options.seed,
  };
  state.entityTools = createGeneratedEntityToolBridge(
    state.runner.app.lowLevel.world,
  );
  await state.runner.app.preload;
  logPlaceholders(log, state.runner);
  syncAspect();

  // Keep autoAspect cameras matched to the render target that snapshots will
  // be rendered at (finding F4). Runs before every extraction so cameras
  // spawned later in the session are covered too.
  function syncAspect(
    width = sessionRenderWidth,
    height = sessionRenderHeight,
  ): void {
    syncAutoAspectCameras(state.runner.app.lowLevel.world, width, height);
  }

  async function boot(seed: number): Promise<void> {
    const previous = state.runner;
    const next = await bootRunner(options, seed);
    disposeRunner(previous);
    state.runner = next;
    state.entityTools = createGeneratedEntityToolBridge(
      state.runner.app.lowLevel.world,
    );
    state.savedCameraStates = new Map();
    state.seed = seed;
    logPlaceholders(log, state.runner);
    syncAspect();
  }

  function compactStatus(): unknown {
    const status = state.runner.getStatus();
    return {
      mode: status.mode,
      nextFrame: status.nextFrame,
      placeholders:
        state.runner.app.lowLevel.assets.createManifestReport().placeholders,
      assetMode: options.assetMode,
      allowHttpAssets: options.allowHttpAssets,
      determinism: options.determinism,
      seed: state.seed,
    };
  }

  function status(input: { readonly digest?: boolean } = {}): unknown {
    const current = state.runner.getStatus();
    // The active seed is a session-level concept the runner status does not
    // carry; surface it here so get-status reports the seed instead of leaving
    // it undefined (finding F7).
    return withOptionalDigests(
      { ...current, seed: state.seed },
      input,
      current,
    );
  }

  function step(input: HeadlessStepInput = {}): unknown {
    syncAspect();
    const frames = positiveIntegerValue(input.frames, 1);
    const delta = finiteNumber(input.delta, DEFAULT_HEADLESS_DELTA);
    const baseTime = finiteNumber(
      input.time,
      state.runner.getStatus().nextFrame * delta,
    );
    const shouldExtract = input.extract !== false;

    let status: ApertureHeadlessStatus;
    let snapshot: RenderSnapshot | undefined;

    if (shouldExtract) {
      let report:
        | ReturnType<ApertureHeadlessRunner["step"]>
        | ReturnType<ApertureHeadlessRunner["extract"]> = state.runner.extract(
        state.runner.getStatus().nextFrame,
      );
      for (let index = 0; index < frames; index += 1) {
        report = state.runner.step(delta, baseTime + index * delta);
      }
      status = report.status;
      snapshot = report.snapshot;
    } else {
      // Step-without-extract escape hatch (F18): skip the up-front and
      // per-frame extraction entirely.
      let stepStatus = state.runner.getStatus();
      for (let index = 0; index < frames; index += 1) {
        stepStatus = state.runner.stepWithoutExtract(
          delta,
          baseTime + index * delta,
        ).status;
      }
      status = stepStatus;
    }

    // Surface determinism violations in every step result (not only in
    // get-status), and honor `--determinism error` in the warm loop by failing
    // the step — matching the one-shot's hard gate (finding F11).
    const violations = determinismViolations(status.diagnostics);
    if (violations.length > 0 && options.determinism === "error") {
      throw new ApertureCliError(
        "aperture.headless.determinismViolation",
        `Headless determinism policy failed with ${violations.length} nondeterministic global use(s): ${describeDeterminismViolations(
          violations,
        )}`,
      );
    }

    return withOptionalDigests(
      {
        nextFrame: status.nextFrame,
        counts: status.lastSnapshot?.counts ?? null,
        extracted: shouldExtract,
        ...(violations.length === 0
          ? {}
          : { determinism: { mode: options.determinism, violations } }),
      },
      input,
      status,
      snapshot,
    );
  }

  function extract(input: HeadlessExtractInput = {}): {
    readonly snapshot: RenderSnapshot;
    readonly result: unknown;
  } {
    syncAspect();
    const report = state.runner.extract(
      finiteNumber(input.frame, state.runner.getStatus().nextFrame),
    );
    return {
      snapshot: report.snapshot,
      result: withOptionalDigests(
        {
          frame: report.snapshot.frame,
          counts: report.status.lastSnapshot?.counts ?? null,
        },
        input,
        report.status,
        report.snapshot,
      ),
    };
  }

  function inject(input: unknown): GeneratedDevtoolsToolResult {
    const stepInput = parseApertureHeadlessInjectStep(input);
    if (stepInput.actions !== undefined) {
      // Fail loudly on a non-button action instead of silently dropping the
      // event downstream (#69).
      assertInjectActionsDriveButtons(
        state.runner.app.context.input,
        stepInput.actions,
      );
    }
    state.runner.enqueueInputBatch(
      createApertureHeadlessInjectEvents(stepInput),
      state.runner.getStatus().nextFrame,
    );
    return { ok: true, result: { injected: true } };
  }

  function dispatchCommand(input: {
    readonly channel: string;
    readonly payload?: unknown;
  }): unknown {
    // Post an app command onto the shared command bus. Systems drain it via
    // context.commands.drain(channel) on the next step. Without this verb the
    // command channel — driven by the browser host/HUD in the browser — could
    // not be exercised headlessly (finding F16).
    if (typeof input.channel !== "string" || input.channel.length === 0) {
      throw new ApertureCliError(
        "aperture.headless.invalidCommand",
        "The command dispatch requires a non-empty 'channel'.",
      );
    }
    state.runner.app.context.commands.queue(input.channel, input.payload);
    return {
      dispatched: true,
      channel: input.channel,
      summary: state.runner.app.context.commands.summary(),
    };
  }

  async function reset(input: HeadlessResetInput = {}): Promise<unknown> {
    await boot(finiteNumber(input.seed, options.seed));
    return { reset: true, status: compactStatus() };
  }

  async function createBundle(input: HeadlessBundleInput): Promise<unknown> {
    const current = state.runner.getStatus();
    const frame =
      current.lastSnapshot === null
        ? current.nextFrame
        : current.lastSnapshot.frame;
    // Re-extract with autoAspect cameras matched to THIS bundle's render
    // target so the recorded projection fits the requested output size.
    syncAspect(
      positiveIntegerValue(input.width, DEFAULT_HEADLESS_RENDER_WIDTH),
      positiveIntegerValue(input.height, DEFAULT_HEADLESS_RENDER_HEIGHT),
    );
    const report = state.runner.extract(frame);
    const bundle = createApertureSnapshotBundle({
      snapshot: report.snapshot,
      assets: state.runner.app.lowLevel.assets,
      options: {
        createdBy: input.createdBy ?? "aperture headless",
        renderTarget: {
          // Carry the app's render/post config (tonemap/exposure/bloom/msaa)
          // so on-demand renders reproduce the final look (#73).
          ...renderBundleTargetFromRenderDefaults(options.config.render),
          width: positiveIntegerValue(
            input.width,
            DEFAULT_HEADLESS_RENDER_WIDTH,
          ),
          height: positiveIntegerValue(
            input.height,
            DEFAULT_HEADLESS_RENDER_HEIGHT,
          ),
        },
        allowPlaceholders: options.assetMode !== "strict",
      },
    });

    await mkdir(path.dirname(input.out), { recursive: true });
    await writeFile(input.out, `${JSON.stringify(bundle)}\n`, "utf8");
    return withOptionalDigests(
      {
        path: input.out,
        frame: bundle.frame,
        assetProvenance: bundle.assetProvenance,
        renderTarget: bundle.renderTarget,
        bundle,
      },
      input,
      report.status,
      report.snapshot,
    );
  }

  async function saveSessionSnapshot(input: {
    readonly out: string;
  }): Promise<unknown> {
    const snapshot = createApertureSessionSnapshot(state.runner);
    await mkdir(path.dirname(input.out), { recursive: true });
    await writeFile(input.out, `${JSON.stringify(snapshot)}\n`, "utf8");
    return {
      path: input.out,
      frame: snapshot.runtime.frame,
      systems: snapshot.runtime.systems.length,
      resources: snapshot.simulation.resources.length,
      signals: snapshot.simulation.signals.length,
    };
  }

  async function restoreSessionSnapshot(input: {
    readonly snapshot: ApertureSessionSnapshot;
  }): Promise<unknown> {
    const previous = state.runner;
    const restored = await restoreApertureHeadlessRunnerFromSessionSnapshot({
      config: options.config,
      systems: options.systems,
      assetLoader: createNodeApertureAssetLoader({
        mode: options.assetMode,
        root: options.root,
        publicDir: options.publicDir,
        allowHttp: options.allowHttpAssets,
        ...(options.decoderAssetsDir === undefined
          ? {}
          : { decoderAssetsDir: options.decoderAssetsDir }),
      }),
      random: state.seed,
      determinism: { globals: options.determinism },
      snapshot: input.snapshot,
    });

    disposeRunner(previous);
    state.runner = restored.runner;
    state.entityTools = createGeneratedEntityToolBridge(
      state.runner.app.lowLevel.world,
    );
    state.savedCameraStates = new Map();
    syncAspect();

    return {
      ok: restored.restore.ok,
      restore: jsonSafeRestoreReport(restored.restore),
      status: compactStatus(),
    };
  }

  function callTool(input: HeadlessToolInput): GeneratedDevtoolsToolResult {
    const args = input.arguments;

    if (input.name.startsWith("ecs_")) {
      if (input.name === "ecs_pause" || input.name === "ecs_resume") {
        return {
          ok: true,
          result: {
            paused: input.name === "ecs_pause",
            note: "Headless sessions advance only when ecs_step/step is called.",
          },
        };
      }

      if (input.name === "ecs_step") {
        return { ok: true, result: step(asRecord(args)) };
      }

      if (input.name === "ecs_list_systems") {
        return {
          ok: true,
          result: { systems: listHeadlessSystems(state.runner) },
        };
      }

      return state.entityTools.call(input.name, args);
    }

    if (input.name.startsWith("input_")) {
      const inputResult = callInputDevtoolsTool(
        state.runner.app,
        input.name,
        args,
        {
          enqueueInputEvent(event) {
            state.runner.enqueueInput(
              event,
              state.runner.getStatus().nextFrame,
            );
          },
        },
      );

      if (inputResult !== null) {
        return inputResult;
      }
    }

    // Composite inject verb (#71): documented as part of the headless loop,
    // it fans out to inject()/input_action_set/input_gamepad_set exactly like
    // the MCP manager's input_inject.
    if (input.name === "input_inject") {
      return inputInjectTool(asRecord(args));
    }

    if (input.name === "logs_read") {
      return logsReadTool(asRecord(args));
    }

    if (input.name === "asset_list") {
      return {
        ok: true,
        result: {
          assets: createAssetSummary(state.runner.app.context.assets.list()),
          manifest: state.runner.app.lowLevel.assets.createManifestReport(),
        },
      };
    }

    if (input.name === "resource_get") {
      return resourceGet(state.runner, args);
    }

    if (input.name === "resource_set") {
      return resourceSet(state.runner, args);
    }

    if (input.name.startsWith("camera_")) {
      return callCameraTool(
        state.runner.app,
        createApertureDevtoolsRequest({
          requestId: `headless-camera-${Date.now()}`,
          tool: input.name,
          ...(args === undefined ? {} : { payload: args }),
        }),
        state.savedCameraStates,
      );
    }

    return unavailable(input.name);
  }

  function inputInjectTool(
    payload: Record<string, unknown>,
  ): GeneratedDevtoolsToolResult {
    const results: GeneratedDevtoolsToolResult[] = [];

    if (isRecord(payload["pointer"])) {
      results.push(inject({ pointer: payload["pointer"] }));
    }

    const actions = isRecord(payload["actions"]) ? payload["actions"] : {};
    for (const [action, value] of Object.entries(actions)) {
      const actionArguments =
        typeof value === "boolean"
          ? { action, pressed: value }
          : typeof value === "number"
            ? { action, value }
            : isRecord(value)
              ? { action, ...value }
              : { action, value };
      results.push(
        callTool({ name: "input_action_set", arguments: actionArguments }),
      );
    }

    if (isRecord(payload["gamepad"])) {
      results.push(
        callTool({ name: "input_gamepad_set", arguments: payload["gamepad"] }),
      );
    }

    const diagnostics = results.flatMap((result) => result.diagnostics ?? []);
    return {
      ok: results.every((result) => result.ok),
      result: { injected: true, results },
      ...(diagnostics.length === 0 ? {} : { diagnostics }),
    };
  }

  function logsReadTool(
    payload: Record<string, unknown>,
  ): GeneratedDevtoolsToolResult {
    recordStatusDiagnostics();
    const lines = Math.max(1, Math.floor(finiteNumber(payload["lines"], 80)));
    return { ok: true, result: { entries: logEntries.slice(-lines) } };
  }

  // Fold the runner's current status diagnostics into the session log ring
  // (deduplicated), so logs_read surfaces step-time diagnostics too.
  function recordStatusDiagnostics(): void {
    for (const diagnostic of state.runner.getStatus().diagnostics) {
      const key = `${diagnostic.code}:${diagnostic.message}`;
      if (loggedDiagnostics.has(key)) {
        continue;
      }
      loggedDiagnostics.add(key);
      log({
        time: new Date().toISOString(),
        level:
          diagnostic.severity === "error"
            ? "error"
            : diagnostic.severity === "warning"
              ? "warn"
              : "info",
        source: "headless-status",
        code: diagnostic.code,
        message: diagnostic.message,
        data: diagnostic,
      });
    }
  }

  function determinismReport(): unknown {
    const current = state.runner.extract(
      state.runner.getStatus().lastSnapshot?.frame ??
        state.runner.getStatus().nextFrame,
    );
    const diagnostics = current.status.diagnostics.filter((diagnostic) =>
      diagnostic.code.startsWith("aperture.determinism."),
    );

    return {
      seed: state.seed,
      determinism: options.determinism,
      nextFrame: current.status.nextFrame,
      fixedStepClock: current.status.fixedStepClock,
      diagnostics,
      digests: {
        ecs: createApertureHeadlessEcsDigest(current.status),
        status: createApertureHeadlessStatusDigest(current.status),
        render: createApertureRenderSnapshotDigest(current.snapshot),
      },
      replay: {
        deterministic: diagnostics.length === 0,
        preconditions: [
          "Use the same headless config, system modules, seed, asset mode, and fixed-step inputs.",
          "Systems must use context.random and context.time instead of nondeterministic globals.",
          "Restore SessionSnapshot artifacts before comparing continuation digests.",
        ],
        violations: diagnostics.map((diagnostic) => diagnostic.code),
      },
    };
  }

  function dispose(): void {
    disposeRunner(state.runner);
  }

  return {
    get runner() {
      return state.runner;
    },
    get seed() {
      return state.seed;
    },
    compactStatus,
    status,
    step,
    extract,
    inject,
    dispatchCommand,
    reset,
    callTool,
    createBundle,
    saveSessionSnapshot,
    restoreSessionSnapshot,
    determinismReport,
    dispose,
  };
}

async function bootRunner(
  options: HeadlessSessionControllerOptions,
  seed: number,
): Promise<ApertureHeadlessRunner> {
  const runner = await createApertureHeadlessRunner({
    config: options.config,
    systems: options.systems,
    assetLoader: createNodeApertureAssetLoader({
      mode: options.assetMode,
      root: options.root,
      publicDir: options.publicDir,
      allowHttp: options.allowHttpAssets,
      ...(options.decoderAssetsDir === undefined
        ? {}
        : { decoderAssetsDir: options.decoderAssetsDir }),
    }),
    random: seed,
    determinism: { globals: options.determinism },
  });
  await runner.app.preload;
  return runner;
}

function logPlaceholders(
  log: (entry: HeadlessSessionLogEntry) => void,
  runner: ApertureHeadlessRunner,
): void {
  const placeholders =
    runner.app.lowLevel.assets.createManifestReport().placeholders;
  for (const id of placeholders.ids) {
    log({
      time: new Date().toISOString(),
      level: "warn",
      source: "asset-loader",
      code: "aperture.headless.assetPlaceholder",
      message: `Asset '${id}' loaded as a Node placeholder.`,
      data: { id },
    });
  }
}

function listHeadlessSystems(
  runner: ApertureHeadlessRunner,
): readonly Record<string, unknown>[] {
  return (runner.app.lowLevel.world.getSystems() as readonly unknown[]).map(
    (system, index) => {
      const constructor = isRecord(system) ? system["constructor"] : undefined;
      const className =
        typeof constructor === "function" && constructor.name.length > 0
          ? constructor.name
          : `System ${index}`;
      const aperture =
        typeof constructor === "function"
          ? (constructor as unknown as Record<string, unknown>)["aperture"]
          : undefined;
      const schedule = isRecord(aperture) ? aperture["schedule"] : undefined;
      const metadataPriority =
        isRecord(schedule) && typeof schedule["priority"] === "number"
          ? schedule["priority"]
          : null;
      // The registered system instance carries the priority the world orders
      // execution by — authoritative for built-in systems that lack the
      // `aperture` static metadata. Surface it as a top-level numeric priority
      // (F14) while keeping the nested value for back-compat.
      const instancePriority =
        isRecord(system) && typeof system["priority"] === "number"
          ? system["priority"]
          : null;
      const priority = instancePriority ?? metadataPriority;

      return {
        index,
        moduleId: className,
        className,
        priority,
        schedule: { priority: metadataPriority },
      };
    },
  );
}

function disposeRunner(runner: ApertureHeadlessRunner): void {
  const systems = runner.app.lowLevel.world.getSystems() as readonly unknown[];
  for (const system of systems) {
    if (isRecord(system) && typeof system["destroy"] === "function") {
      system["destroy"].call(system);
    }
  }

  runner.app.physics?.dispose();
}

function resourceGet(
  runner: ApertureHeadlessRunner,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = asRecord(payload);
  const id = stringValue(record["id"]);

  if (Object.prototype.hasOwnProperty.call(record, "id")) {
    if (id === undefined || id.trim().length === 0) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.resource.invalidDevtoolsId",
            severity: "error",
            message: "resource_get id must be a non-empty string.",
            suggestedFix:
              "Pass { id: 'your.resource.id' }, or omit id to list all generated app resources.",
          },
        ],
      };
    }
  }

  const summary = runner.app.context.resources.summary();
  if (id === undefined) {
    return { ok: true, result: { resources: summary } };
  }

  const resource = summary.entries.find((entry) => entry.id === id) ?? null;
  if (resource === null) {
    return {
      ok: false,
      result: {
        id,
        resource: null,
        resources: { count: 0, entries: [] },
      },
      diagnostics: [resourceNotFoundDiagnostic(id)],
    };
  }

  return {
    ok: true,
    result: {
      id,
      resource,
      resources: { count: 1, entries: [resource] },
    },
  };
}

function resourceSet(
  runner: ApertureHeadlessRunner,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = asRecord(payload);
  const id = stringValue(record["id"]);
  if (id === undefined || id.trim().length === 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.resource.invalidDevtoolsId",
          severity: "error",
          message: "resource_set id must be a non-empty string.",
          suggestedFix:
            "Pass { id: 'your.resource.id', values: { fieldName: value } }.",
        },
      ],
    };
  }

  const values = record["values"] ?? record["fields"];
  if (!isRecord(values) || Object.keys(values).length === 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.resource.invalidDevtoolsValues",
          severity: "error",
          message: "resource_set values must be a non-empty object.",
          suggestedFix:
            "Pass { values: { fieldName: value } } using fields reported by resource_get.",
        },
      ],
    };
  }

  try {
    const resource = runner.app.context.resources.patchById(id, values);
    if (resource === null) {
      return {
        ok: false,
        result: {
          id,
          resource: null,
          resources: { count: 0, entries: [] },
        },
        diagnostics: [resourceNotFoundDiagnostic(id)],
      };
    }

    return {
      ok: true,
      result: {
        id,
        resource,
        resources: { count: 1, entries: [resource] },
      },
    };
  } catch (error: unknown) {
    if (isSystemErrorLike(error)) {
      return {
        ok: false,
        diagnostics: [
          {
            code: error.code,
            severity: "error",
            message: error.message,
            suggestedFix: error.suggestedFix,
            ...(error.detail === undefined ? {} : { data: error.detail }),
          },
        ],
      };
    }

    throw error;
  }
}

function resourceNotFoundDiagnostic(
  id: string,
): Readonly<Record<string, unknown>> {
  return {
    code: "aperture.resource.notFound",
    severity: "warning",
    message: `Generated app resource '${id}' was not found.`,
    suggestedFix:
      "Call resource_get without an id to list resources currently initialized by generated worker systems.",
  };
}

function jsonSafeRestoreReport(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const scene = isRecord(value["scene"]) ? value["scene"] : {};
  const sceneEntities = Array.isArray(scene["entities"])
    ? scene["entities"].length
    : 0;

  return {
    ok: value["ok"] === true,
    scene: {
      ok: scene["ok"] === true,
      entities: sceneEntities,
      diagnostics: Array.isArray(scene["diagnostics"])
        ? scene["diagnostics"]
        : [],
    },
    sourceAssets: value["sourceAssets"],
    resources: value["resources"],
    signals: value["signals"],
    random: value["random"],
    fixedStepClock: value["fixedStepClock"],
    systems: value["systems"],
  };
}

interface DeterminismViolation {
  readonly code: string;
  readonly system: string;
  readonly phase: string;
  readonly api: string;
  readonly suggestedApi: string;
}

function determinismViolations(
  diagnostics: ApertureHeadlessStatus["diagnostics"],
): DeterminismViolation[] {
  return diagnostics
    .filter(
      (diagnostic) =>
        diagnostic.code === "aperture.determinism.nondeterministicGlobal",
    )
    .map((diagnostic) => {
      const data = (diagnostic.data ?? {}) as Record<string, unknown>;
      const stringField = (key: string, fallback: string): string =>
        typeof data[key] === "string" ? (data[key] as string) : fallback;
      return {
        code: diagnostic.code,
        system: stringField("system", "unknown system"),
        phase: stringField("phase", "unknown phase"),
        api: stringField("api", "unknown API"),
        suggestedApi: stringField(
          "suggestedApi",
          "context.random/context.time",
        ),
      };
    });
}

function describeDeterminismViolations(
  violations: readonly DeterminismViolation[],
): string {
  return violations
    .map(
      (violation) =>
        `${violation.system} called ${violation.api} during ${violation.phase} (use ${violation.suggestedApi})`,
    )
    .join("; ");
}

function withOptionalDigests<T extends object>(
  result: T,
  params: { readonly digest?: unknown },
  status: ApertureHeadlessStatus,
  snapshot?: RenderSnapshot,
): T & {
  readonly digests?: {
    readonly ecs: ReturnType<typeof createApertureHeadlessEcsDigest>;
    readonly status: ReturnType<typeof createApertureHeadlessStatusDigest>;
    readonly snapshot?: ReturnType<typeof createApertureRenderSnapshotDigest>;
  };
} {
  if (params.digest !== true) {
    return result;
  }

  return {
    ...result,
    digests: {
      ecs: createApertureHeadlessEcsDigest(status),
      status: createApertureHeadlessStatusDigest(status),
      ...(snapshot === undefined
        ? {}
        : { snapshot: createApertureRenderSnapshotDigest(snapshot) }),
    },
  };
}

function unavailable(name: string): GeneratedDevtoolsToolResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: "aperture.headless.toolUnavailable",
        message:
          `Tool '${name}' is not available in a headless session. ` +
          "Headless sessions support ecs_* (except ecs_step_and_diff), " +
          "camera_*, asset_list, resource_get/resource_set, logs_read, and " +
          "these input tools: input_inject, input_action_set, " +
          "input_gamepad_set, input_get_state, input_reset. Raw-device " +
          "tools (input_key, input_pointer_*) need the headed browser slot; " +
          "headlessly, drive the action layer with " +
          "input_action_set({ action, x, y }) or the gamepad path with " +
          "input_gamepad_set({ left: { x, y } }) instead.",
      },
    ],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSystemErrorLike(value: unknown): value is {
  readonly code: string;
  readonly message: string;
  readonly suggestedFix?: string;
  readonly detail?: unknown;
} {
  return (
    isRecord(value) &&
    typeof value["code"] === "string" &&
    typeof value["message"] === "string"
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveIntegerValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}
