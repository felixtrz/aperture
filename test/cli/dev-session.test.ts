import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import {
  mkdtemp,
  mkdir,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apertureRuntimeDir,
  apertureSessionFile,
  callApertureTool,
  createApertureDevSession,
  isProcessAlive,
  readApertureDevSession,
  resolveApertureDevServerPort,
  runApertureCli,
  runApertureMcpServer,
  startApertureDevSession,
  stopApertureDevSession,
  writeApertureDevSession,
} from "@aperture-engine/cli";

const tempRoots: string[] = [];
const HEADLESS_CONFIG = fileURLToPath(
  new URL(
    "../fixtures/headless-procedural/aperture.headless.config.ts",
    import.meta.url,
  ),
);
const NONDETERMINISTIC_HEADLESS_CONFIG = fileURLToPath(
  new URL(
    "../fixtures/headless-nondeterministic/aperture.headless.config.ts",
    import.meta.url,
  ),
);

describe("Aperture CLI dev session and MCP command surface", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("reports missing dev sessions without failing", async () => {
    const root = await tempRoot();
    const status = await runCli(["dev", "status"], root);
    const logs = await runCli(["dev", "logs"], root);
    const open = await runCli(["dev", "open"], root);
    const down = await runCli(["dev", "down"], root);

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("No Aperture dev session found");
    expect(logs.exitCode).toBe(0);
    expect(logs.stdout).toContain("No Aperture dev session found");
    expect(open.exitCode).toBe(1);
    expect(open.stderr).toContain("No Aperture dev session exists");
    expect(down.exitCode).toBe(0);
    expect(down.stdout).toContain("No Aperture dev session was active");
  });

  it("reports invalid app roots before starting a managed dev session", async () => {
    const root = await tempRoot();
    const up = await runCli(["dev", "up"], root);

    expect(up.exitCode).toBe(1);
    expect(up.stdout).toBe("");
    expect(up.stderr).toContain("aperture.dev.invalidAppRoot");
    expect(up.stderr).toContain("vite.config.ts");
    expect(up.stderr).toContain(root);
    expect(await readApertureDevSession(root)).toBeNull();
  });

  it("reads session state and dev logs from .aperture/runtime", async () => {
    const root = await tempRoot();
    const runtimeDir = apertureRuntimeDir(root);
    const daemonLog = path.join(runtimeDir, "daemon.log");
    const serverLog = path.join(runtimeDir, "server.log");
    const browserLog = path.join(runtimeDir, "browser.log");

    await mkdir(runtimeDir, { recursive: true });
    await writeFile(daemonLog, "daemon one\ndaemon two\n", "utf8");
    await writeFile(serverLog, "server one\nserver two\n", "utf8");
    await writeFile(browserLog, "browser one\nbrowser two\n", "utf8");
    await writeApertureDevSession(
      createApertureDevSession({
        appRoot: root,
        url: "http://127.0.0.1:5173/",
        host: "127.0.0.1",
        port: 5173,
        daemonPid: null,
        serverPid: null,
        browserPid: null,
        browserCdpPort: 6173,
        browserHeadless: true,
        daemonState: "running",
        serverState: "running",
        browserState: "running",
        logs: {
          daemon: daemonLog,
          server: serverLog,
          browser: browserLog,
        },
      }),
    );

    const status = await runCli(["dev", "status"], root);
    const logs = await runCli(["dev", "logs", "--lines", "1"], root);
    const down = await runCli(["dev", "down"], root);

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("http://127.0.0.1:5173/");
    expect(status.stdout).toContain("not running");
    expect(logs.exitCode).toBe(0);
    expect(logs.stdout).toContain("daemon.log");
    expect(logs.stdout).toContain("server two");
    expect(logs.stdout).toContain("browser two");
    expect(down.exitCode).toBe(0);
    expect(await readApertureDevSession(root)).toBeNull();
  });

  it("treats an empty or corrupt session.json as no session instead of crashing", async () => {
    const root = await tempRoot();
    const sessionFile = apertureSessionFile(root);
    await mkdir(path.dirname(sessionFile), { recursive: true });

    // JSON.parse("") throws "Unexpected end of JSON input"; this previously
    // escaped readApertureDevSession and failed whole `dev` commands.
    await writeFile(sessionFile, "", "utf8");
    expect(await readApertureDevSession(root)).toBeNull();

    await writeFile(sessionFile, '{"appRoot": "/tru', "utf8");
    expect(await readApertureDevSession(root)).toBeNull();
  });

  it("replaces session.json atomically without leaving temp files", async () => {
    const root = await tempRoot();
    const session = createApertureDevSession({
      appRoot: root,
      url: "http://127.0.0.1:5173/",
      host: "127.0.0.1",
      port: 5173,
      daemonPid: null,
      serverPid: null,
      browserPid: null,
      browserCdpPort: null,
      browserHeadless: true,
      daemonState: "running",
      serverState: "running",
      browserState: "starting",
      logs: {
        daemon: "daemon.log",
        server: "server.log",
        browser: "browser.log",
      },
    });

    // The daemon rewrites the session file while other CLI processes read it;
    // both the initial write and an overwrite must land via rename so readers
    // never observe partial JSON, and must not leave temp files behind.
    await writeApertureDevSession(session);
    await writeApertureDevSession({
      ...session,
      browser: { ...session.browser, state: "running" },
    });

    expect(await readdir(apertureRuntimeDir(root))).toEqual(["session.json"]);
    expect(await readApertureDevSession(root)).toMatchObject({
      port: 5173,
      browser: { state: "running" },
    });
  });

  it("serves MCP initialize, shared tools/list, and missing-session diagnostics over stdio", async () => {
    const root = await tempRoot();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const chunks: string[] = [];
    const errors: string[] = [];

    stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });
    stderr.on("data", (chunk: Buffer) => {
      errors.push(chunk.toString());
    });

    const done = runApertureMcpServer({ cwd: root, stdin, stdout, stderr });

    stdin.write("{not json\n");
    stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "tools/list" })}\n`,
    );
    stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n`,
    );
    stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`,
    );
    stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "ecs_snapshot",
          arguments: { target: "headed" },
        },
      })}\n`,
    );
    stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 4, method: "nope" })}\n`,
    );
    stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
      })}\n`,
    );
    stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {},
      })}\n`,
    );
    stdin.end();
    await done;

    const messages = chunks
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as JsonRecord);
    const initialize = messages.find((message) => message.id === 1);
    const tools = messages.find((message) => message.id === 2);
    const call = messages.find((message) => message.id === 3);
    const unsupported = messages.find((message) => message.id === 4);
    const missingParams = messages.find((message) => message.id === 5);
    const missingTool = messages.find((message) => message.id === 6);

    expect(errors.join("")).toContain("aperture.mcp.invalidJson");
    expect(messages.some((message) => message.id === undefined)).toBe(false);
    expect(initialize?.result).toMatchObject({
      capabilities: { tools: {} },
      serverInfo: { name: "aperture" },
    });
    const names = toolNames(tools?.result);
    expect(names).toEqual(
      expect.arrayContaining([
        "app_status",
        "app_start",
        "app_stop",
        "app_reset",
        "frame_capture",
        "logs_read",
        "render_bundle",
        "session_snapshot_save",
        "session_snapshot_restore",
        "determinism_report",
        "input_inject",
        "input_get_state",
        "input_reset",
        "camera_get",
        "camera_create_agent",
        "reference_search",
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining([
        "browser_status",
        "browser_canvas_status",
        "browser_screenshot",
        "browser_console_logs",
        "browser_reload",
        "browser_wait_for_webgpu",
        "browser_pick_pixel",
        "render_readback_samples",
      ]),
    );
    expect(names).toEqual([
      "app_status",
      "app_start",
      "app_stop",
      "app_reset",
      "ecs_step",
      "ecs_find_entities",
      "ecs_get_entity",
      "ecs_query",
      "ecs_get_component_schema",
      "ecs_snapshot",
      "ecs_diff",
      "ecs_list_systems",
      "ecs_pause",
      "ecs_resume",
      "ecs_set_component_field",
      "ecs_get_hierarchy",
      "asset_list",
      "resource_get",
      "resource_set",
      "input_inject",
      "input_get_state",
      "input_reset",
      "camera_list",
      "camera_get",
      "camera_save",
      "camera_restore",
      "camera_create_agent",
      "camera_set_transform",
      "camera_look_at",
      "camera_orbit",
      "camera_fit_entity",
      "camera_use_agent_view",
      "frame_capture",
      "logs_read",
      "render_bundle",
      "session_snapshot_save",
      "session_snapshot_restore",
      "determinism_report",
      "command_dispatch",
      "reference_search",
      "reference_api_lookup",
      "reference_file_content",
      "reference_find_examples",
      "reference_list_components",
      "reference_list_systems",
      "reference_find_dependents",
      "reference_explain_diagnostic",
    ]);
    expect(call?.result).toMatchObject({
      structuredContent: {
        ok: false,
        diagnostic: {
          code: "aperture.mcp.sessionMissing",
        },
      },
    });
    expect(unsupported?.error).toMatchObject({
      code: -32_000,
      message: "Unsupported MCP method 'nope'.",
    });
    expect(missingParams?.error).toMatchObject({
      code: -32_000,
      message: "MCP tools/call requires params.",
    });
    expect(missingTool?.error).toMatchObject({
      code: -32_000,
      message: "MCP tools/call requires a tool name.",
    });
  });

  it("keeps one persistent headless MCP slot for shared runtime tools", async () => {
    const outRoot = await tempRoot();
    const bundleOut = path.join(outRoot, "frame.bundle.json");
    const snapshotOut = path.join(outRoot, "session.snapshot.json");
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: string[] = [];

    stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    const done = runApertureMcpServer({
      cwd: process.cwd(),
      stdin,
      stdout,
    });

    for (const request of [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "app_start",
          arguments: {
            target: "headless",
            config: HEADLESS_CONFIG,
            seed: 7,
          },
        },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "ecs_step",
          arguments: { target: "headless", frames: 2, digest: true },
        },
      },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "camera_get",
          arguments: { target: "headless", key: "camera.main" },
        },
      },
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "ecs_list_systems",
          arguments: { target: "headless" },
        },
      },
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "render_bundle",
          arguments: {
            target: "headless",
            out: bundleOut,
            digest: true,
          },
        },
      },
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "session_snapshot_save",
          arguments: { target: "headless", out: snapshotOut },
        },
      },
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "determinism_report",
          arguments: { target: "headless" },
        },
      },
      {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "app_stop",
          arguments: { target: "headless" },
        },
      },
    ]) {
      stdin.write(`${JSON.stringify(request)}\n`);
    }
    stdin.end();
    await done;

    const messages = chunks
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as JsonRecord);

    expect(structured(messages, 1)).toMatchObject({
      ok: true,
      target: "headless",
      status: { seed: 7 },
    });
    expect(structured(messages, 2)).toMatchObject({
      ok: true,
      target: "headless",
      frame: 2,
      result: { nextFrame: 2 },
      diagnostics: [],
    });
    expect(structured(messages, 3)).toMatchObject({
      ok: true,
      target: "headless",
      result: { key: "camera.main" },
    });
    expect(structured(messages, 4)).toMatchObject({
      ok: true,
      target: "headless",
      systems: expect.arrayContaining([
        expect.objectContaining({ className: "SceneSystem" }),
      ]),
    });
    expect(structured(messages, 5)).toMatchObject({
      ok: true,
      target: "headless",
      path: bundleOut,
    });
    expect(structured(messages, 5)).not.toHaveProperty("bundle");
    expect(structured(messages, 6)).toMatchObject({
      ok: true,
      target: "headless",
      path: snapshotOut,
      frame: 2,
    });
    expect(structured(messages, 7)).toMatchObject({
      ok: true,
      target: "headless",
      seed: 7,
      nextFrame: 2,
      frame: 2,
      diagnostics: [],
      fixedStepClock: expect.any(Object),
      digests: {
        ecs: { hash: expect.stringMatching(/^[0-9a-f]{8}$/u) },
        status: { hash: expect.stringMatching(/^[0-9a-f]{8}$/u) },
        render: { hash: expect.stringMatching(/^[0-9a-f]{8}$/u) },
      },
      replay: {
        deterministic: true,
        preconditions: expect.arrayContaining([
          expect.stringContaining("same headless config"),
        ]),
        violations: [],
      },
    });
    expect(structured(messages, 8)).toMatchObject({
      ok: true,
      target: "headless",
      stopped: true,
    });
  });

  it("preflights headless frame_capture bundles before rendering placeholder assets", async () => {
    const root = await placeholderGltfFixture();
    const messages = await runMcpRequestSequence(process.cwd(), [
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: path.join(root, "aperture.headless.config.ts"),
          assetMode: "placeholder",
          seed: 3,
        },
      },
      {
        name: "frame_capture",
        arguments: {
          target: "headless",
          width: 64,
          height: 64,
        },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
    ]);

    expect(structured(messages, 1)).toMatchObject({
      ok: true,
      target: "headless",
    });
    expect(structured(messages, 2)).toMatchObject({
      ok: false,
      target: "headless",
      mode: "headless",
      source: "render-bundle",
      bundlePath: expect.stringMatching(/headless-frame-\d+\.bundle\.json$/u),
      renderTarget: {
        width: 64,
        height: 64,
      },
      diagnostics: [
        expect.objectContaining({
          code: "aperture.render.incompleteBundle",
          severity: "error",
          data: expect.objectContaining({
            placeholders: expect.arrayContaining([expect.any(String)]),
          }),
        }),
      ],
    });
    expect(structured(messages, 2)).not.toHaveProperty("pngPath");
    expect(structured(messages, 3)).toMatchObject({
      ok: true,
      stopped: true,
    });
  });

  it("returns shared MCP envelopes for successful and expected-error tool calls", async () => {
    const messages = await runMcpRequestSequence(process.cwd(), [
      {
        name: "app_status",
        arguments: {},
      },
      {
        name: "app_status",
        arguments: { target: "headless" },
      },
      {
        name: "ecs_step",
        arguments: { target: "headless", frames: 1 },
      },
      {
        name: "app_start",
        arguments: {},
      },
    ]);

    expect(structured(messages, 1)).toMatchObject({
      ok: true,
      target: "all",
      mode: "all",
      diagnostics: [],
      headed: {
        target: "headed",
        mode: "headed",
        running: false,
      },
      headless: {
        target: "headless",
        mode: "headless",
        running: false,
      },
    });
    expect(structured(messages, 2)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      running: false,
      diagnostics: [],
    });
    expect(messages.find((message) => message.id === 3)).not.toHaveProperty(
      "error",
    );
    expect(structured(messages, 3)).toMatchObject({
      ok: false,
      target: "headless",
      mode: "headless",
      diagnostics: [
        expect.objectContaining({
          code: "aperture.mcp.headlessSessionMissing",
        }),
      ],
    });
    expect(structured(messages, 4)).toMatchObject({
      ok: false,
      target: "all",
      mode: "all",
      diagnostics: [
        expect.objectContaining({
          code: "aperture.mcp.targetMissing",
        }),
      ],
    });
  });

  it("returns diagnostics for headless-only MCP validation paths", async () => {
    const outRoot = await tempRoot();
    const messages = await runMcpRequestSequence(process.cwd(), [
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: HEADLESS_CONFIG,
          seed: 1,
        },
      },
      {
        name: "render_bundle",
        arguments: { target: "headless" },
      },
      {
        name: "session_snapshot_save",
        arguments: { target: "headless" },
      },
      {
        name: "session_snapshot_restore",
        arguments: { target: "headless" },
      },
      {
        name: "render_bundle",
        arguments: {
          target: "headed",
          out: path.join(outRoot, "invalid.bundle.json"),
        },
      },
      {
        name: "app_reset",
        arguments: { target: "headless", seed: 19 },
      },
      {
        name: "app_status",
        arguments: { target: "headless" },
      },
      {
        name: "render_bundle",
        arguments: {
          target: "headless",
          out: path.join(outRoot, "frame.bundle.json"),
          includeBundle: true,
          digest: true,
          width: 320,
          height: 200,
        },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
    ]);

    expect(structured(messages, 2)).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "aperture.mcp.outputMissing" }),
      ],
    });
    expect(structured(messages, 3)).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "aperture.mcp.outputMissing" }),
      ],
    });
    expect(structured(messages, 4)).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "aperture.mcp.snapshotMissing" }),
      ],
    });
    expect(structured(messages, 5)).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "aperture.mcp.invalidTarget" }),
      ],
    });
    expect(structured(messages, 6)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      result: {
        reset: true,
        status: { seed: 19 },
      },
    });
    expect(structured(messages, 7)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      running: true,
      status: { mode: "headless" },
    });
    expect(structured(messages, 8)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      path: path.join(outRoot, "frame.bundle.json"),
      bundle: {
        format: "aperture.render-bundle",
        renderTarget: {
          width: 320,
          height: 200,
        },
        digest: {
          hash: expect.stringMatching(/^[0-9a-f]{8}$/u),
        },
      },
    });
    expect(structured(messages, 9)).toMatchObject({
      ok: true,
      target: "headless",
      stopped: true,
      hadSession: true,
    });
    expect(structured(messages, 10)).toMatchObject({
      ok: true,
      target: "headless",
      stopped: false,
      hadSession: false,
    });
  });

  it("defaults shared state tools to the warm headless slot when it is running", async () => {
    const messages = await runMcpRequestSequence(process.cwd(), [
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: HEADLESS_CONFIG,
          seed: 5,
        },
      },
      {
        name: "ecs_step",
        arguments: { frames: 1, digest: true },
      },
      {
        name: "resource_get",
        arguments: {},
      },
      {
        name: "input_get_state",
        arguments: {},
      },
      {
        name: "logs_read",
        arguments: { lines: 10 },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
    ]);

    expect(structured(messages, 2)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      frame: 1,
      result: {
        nextFrame: 1,
        digests: {
          ecs: { hash: expect.stringMatching(/^[0-9a-f]{8}$/u) },
        },
      },
      diagnostics: [],
    });
    expect(structured(messages, 3)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      result: { resources: { count: expect.any(Number) } },
      diagnostics: [],
    });
    expect(structured(messages, 4)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      result: { diagnostics: [] },
      diagnostics: [],
    });
    expect(structured(messages, 5)).toMatchObject({
      ok: true,
      target: "headless",
      mode: "headless",
      entries: expect.any(Array),
      diagnostics: [],
    });
  });

  it("records headless command failures and determinism diagnostics in logs_read", async () => {
    const messages = await runMcpRequestSequence(process.cwd(), [
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: NONDETERMINISTIC_HEADLESS_CONFIG,
          determinism: "warn",
        },
      },
      {
        name: "resource_get",
        arguments: { target: "headless", id: "" },
      },
      {
        name: "ecs_step",
        arguments: { target: "headless", frames: 1 },
      },
      {
        name: "determinism_report",
        arguments: { target: "headless" },
      },
      {
        name: "logs_read",
        arguments: { target: "headless", lines: 50 },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
    ]);

    expect(structured(messages, 2)).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.resource.invalidDevtoolsId",
        }),
      ],
    });
    expect(structured(messages, 4)).toMatchObject({
      ok: true,
      diagnostics: [
        expect.objectContaining({
          code: expect.stringMatching(/^aperture\.determinism\./u),
        }),
      ],
      digests: {
        render: { hash: expect.stringMatching(/^[0-9a-f]{8}$/u) },
      },
      replay: {
        deterministic: false,
        violations: expect.arrayContaining([
          expect.stringMatching(/^aperture\.determinism\./u),
        ]),
      },
    });

    const entries = valueAt(structured(messages, 5), ["entries"]);
    expect(logCodes(entries)).toEqual(
      expect.arrayContaining([
        "aperture.resource.invalidDevtoolsId",
        expect.stringMatching(/^aperture\.determinism\./u),
      ]),
    );
  });

  it("restores a headless SessionSnapshot into a fresh slot and preserves stepped digests", async () => {
    const outRoot = await tempRoot();
    const snapshotOut = path.join(outRoot, "restore.snapshot.json");
    const messages = await runMcpRequestSequence(process.cwd(), [
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: HEADLESS_CONFIG,
          seed: 11,
        },
      },
      {
        name: "ecs_step",
        arguments: { target: "headless", frames: 2, digest: true },
      },
      {
        name: "session_snapshot_save",
        arguments: { target: "headless", out: snapshotOut },
      },
      {
        name: "ecs_step",
        arguments: { target: "headless", frames: 1, digest: true },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: HEADLESS_CONFIG,
          seed: 99,
        },
      },
      {
        name: "session_snapshot_restore",
        arguments: { target: "headless", path: snapshotOut },
      },
      {
        name: "ecs_step",
        arguments: { target: "headless", frames: 1, digest: true },
      },
      {
        name: "app_stop",
        arguments: { target: "headless" },
      },
    ]);

    expect(structured(messages, 7)).toMatchObject({
      ok: true,
      target: "headless",
      diagnostics: [],
      restore: { ok: true },
    });
    expect(
      valueAt(structured(messages, 8), ["result", "digests", "ecs", "hash"]),
    ).toBe(
      valueAt(structured(messages, 4), ["result", "digests", "ecs", "hash"]),
    );
  });

  it("tracks one headed MCP slot and routes headed calls to it by default", async () => {
    const rootA = await realpath(await tempRoot());
    const rootB = await realpath(await tempRoot());
    await writeFile(path.join(rootA, "vite.config.ts"), "export default {};\n");
    await writeFile(path.join(rootB, "vite.config.ts"), "export default {};\n");
    const entryPoint = await fakeDevDaemonEntryPoint(rootA);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: string[] = [];

    stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    const done = runApertureMcpServer({
      cwd: process.cwd(),
      entryPoint,
      stdin,
      stdout,
    });

    for (const request of [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "app_start",
          arguments: {
            target: "headed",
            appRoot: rootA,
            port: 5311,
            headless: true,
          },
        },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "app_status",
          arguments: { target: "headed" },
        },
      },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "app_start",
          arguments: {
            target: "headed",
            appRoot: rootB,
            port: 5312,
            headless: true,
          },
        },
      },
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "app_status",
          arguments: { target: "headed" },
        },
      },
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "app_stop",
          arguments: { target: "headed" },
        },
      },
    ]) {
      stdin.write(`${JSON.stringify(request)}\n`);
    }
    stdin.end();
    await done;

    const messages = chunks
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as JsonRecord);

    expect(structured(messages, 1)).toMatchObject({
      ok: true,
      target: "headed",
      session: { appRoot: rootA },
    });
    expect(
      valueAt(structured(messages, 2), ["status", "session", "appRoot"]),
    ).toBe(rootA);
    expect(structured(messages, 3)).toMatchObject({
      ok: true,
      target: "headed",
      session: { appRoot: rootB },
    });
    expect(
      valueAt(structured(messages, 4), ["status", "session", "appRoot"]),
    ).toBe(rootB);
    expect(structured(messages, 5)).toMatchObject({
      ok: true,
      target: "headed",
    });
  });

  it("returns structured diagnostics for stale browser debugging sessions", async () => {
    const root = await tempRoot();
    const runtimeDir = apertureRuntimeDir(root);
    const daemonLog = path.join(runtimeDir, "daemon.log");
    const serverLog = path.join(runtimeDir, "server.log");
    const browserLog = path.join(runtimeDir, "browser.log");

    await mkdir(runtimeDir, { recursive: true });
    await writeApertureDevSession(
      createApertureDevSession({
        appRoot: root,
        url: "http://127.0.0.1:5173/",
        host: "127.0.0.1",
        port: 5173,
        daemonPid: null,
        serverPid: null,
        browserPid: null,
        browserCdpPort: 9,
        browserHeadless: true,
        daemonState: "running",
        serverState: "running",
        browserState: "running",
        logs: {
          daemon: daemonLog,
          server: serverLog,
          browser: browserLog,
        },
      }),
    );

    const result = await callApertureTool({
      cwd: root,
      name: "browser_status",
      arguments: {},
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.mcp.browserConnectFailed",
      },
    });
  });

  it("restarts stale managed sessions instead of reusing a live daemon with a dead browser", async () => {
    const root = await tempRoot();
    const runtimeDir = apertureRuntimeDir(root);
    const daemonLog = path.join(runtimeDir, "daemon.log");
    const serverLog = path.join(runtimeDir, "server.log");
    const browserLog = path.join(runtimeDir, "browser.log");
    const staleDaemon = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000);"],
      {
        stdio: "ignore",
      },
    );

    try {
      await writeFile(
        path.join(root, "vite.config.ts"),
        "export default {};\n",
        "utf8",
      );
      await mkdir(runtimeDir, { recursive: true });
      await writeApertureDevSession(
        createApertureDevSession({
          appRoot: root,
          url: "http://127.0.0.1:5173/",
          host: "127.0.0.1",
          port: 5173,
          daemonPid: staleDaemon.pid ?? null,
          serverPid: null,
          browserPid: 9,
          browserCdpPort: 6173,
          browserHeadless: true,
          daemonState: "running",
          serverState: "running",
          browserState: "running",
          logs: {
            daemon: daemonLog,
            server: serverLog,
            browser: browserLog,
          },
        }),
      );

      const entryPoint = await fakeDevDaemonEntryPoint(root);
      const report = await startApertureDevSession({
        cwd: root,
        entryPoint,
        port: 5188,
        headless: true,
        timeoutMs: 5_000,
      });

      expect(report.reused).toBe(false);
      expect(report.session.port).toBe(5188);
      expect(report.session.daemon.pid).not.toBe(staleDaemon.pid ?? null);
      expect(isProcessAlive(staleDaemon.pid ?? null)).toBe(false);
    } finally {
      if (isProcessAlive(staleDaemon.pid ?? null)) {
        staleDaemon.kill("SIGTERM");
      }
      await stopApertureDevSession({ cwd: root });
    }
  });

  it("starts open managed sessions without forcing headless mode", async () => {
    const root = await tempRoot();
    const entryPoint = await fakeDevDaemonEntryPoint(root);

    try {
      await writeFile(
        path.join(root, "vite.config.ts"),
        "export default {};\n",
        "utf8",
      );
      const report = await startApertureDevSession({
        cwd: root,
        entryPoint,
        port: 5199,
        open: true,
        timeoutMs: 5_000,
      });

      expect(report.reused).toBe(false);
      expect(report.session.browser.headless).toBe(false);
    } finally {
      await stopApertureDevSession({ cwd: root });
    }
  });

  it("prints dev and mcp help", async () => {
    const root = await tempRoot();
    const dev = await runCli(["dev", "--help"], root);
    const mcp = await runCli(["mcp", "--help"], root);

    expect(dev.exitCode).toBe(0);
    expect(dev.stdout).toContain("aperture dev up");
    expect(dev.stdout).toContain("aperture dev down");
    expect(mcp.exitCode).toBe(0);
    expect(mcp.stdout).toContain("aperture mcp stdio");
  });

  it("chooses the next available dev port when strict port mode is disabled", async () => {
    const server = net.createServer();
    const host = "127.0.0.1";
    const occupiedPort = await listenOnEphemeralPort(server, host);

    try {
      await expect(
        resolveApertureDevServerPort({
          host,
          port: occupiedPort,
          strictPort: true,
        }),
      ).resolves.toBe(occupiedPort);
      await expect(
        resolveApertureDevServerPort({
          host,
          port: occupiedPort,
          strictPort: false,
        }),
      ).resolves.toBeGreaterThan(occupiedPort);
    } finally {
      await closeServer(server);
    }
  });
});

type JsonRecord = Record<string, unknown>;

function toolNames(value: unknown): readonly string[] {
  const tools =
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { readonly tools?: unknown }).tools)
      ? (value as { readonly tools: readonly unknown[] }).tools
      : [];

  return tools.map((tool) =>
    typeof tool === "object" &&
    tool !== null &&
    typeof (tool as { readonly name?: unknown }).name === "string"
      ? (tool as { readonly name: string }).name
      : "",
  );
}

function structured(messages: readonly JsonRecord[], id: number): unknown {
  const result = messages.find((message) => message.id === id)?.result;
  return isRecord(result) ? result["structuredContent"] : undefined;
}

function valueAt(value: unknown, pathSegments: readonly string[]): unknown {
  let current = value;
  for (const segment of pathSegments) {
    current = isRecord(current) ? current[segment] : undefined;
  }
  return current;
}

async function runMcpRequestSequence(
  cwd: string,
  calls: readonly {
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  }[],
): Promise<JsonRecord[]> {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const chunks: string[] = [];

  stdout.on("data", (chunk: Buffer) => {
    chunks.push(chunk.toString());
  });

  const done = runApertureMcpServer({ cwd, stdin, stdout });

  calls.forEach((call, index) => {
    stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: index + 1,
        method: "tools/call",
        params: {
          name: call.name,
          arguments: call.arguments,
        },
      })}\n`,
    );
  });
  stdin.end();
  await done;

  return chunks
    .join("")
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as JsonRecord);
}

function logCodes(value: unknown): readonly unknown[] {
  return Array.isArray(value)
    ? value.map((entry) => (isRecord(entry) ? entry["code"] : undefined))
    : [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

async function placeholderGltfFixture(): Promise<string> {
  const root = await tempRoot();
  const systemsDir = path.join(root, "src", "systems");
  await mkdir(systemsDir, { recursive: true });
  await writeFile(
    path.join(root, "aperture.headless.config.ts"),
    `import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    missingStudio: asset.hdr("/assets/missing.hdr", { preload: "blocking" }),
  },
  render: { defaultCamera: false, defaultLight: false },
});
`,
    "utf8",
  );
  await writeFile(
    path.join(systemsDir, "placeholder.system.ts"),
    `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class PlaceholderSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const studio = this.assets.hdr("missingStudio");

    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
    });
    this.spawn.mesh({
      key: "cube",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [0, 0, 0] },
    });
    this.spawn.light({
      key: "environment",
      kind: "environment",
      light: {
        environmentMap: studio.renderHandle,
      },
    });
  }
}
`,
    "utf8",
  );

  return root;
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-dev-cli-"));
  tempRoots.push(root);
  return root;
}

async function fakeDevDaemonEntryPoint(root: string): Promise<string> {
  const entryPoint = path.join(root, "fake-aperture-daemon.cjs");

  await writeFile(
    entryPoint,
    `const fs = require("node:fs");
const path = require("node:path");

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
};
const appRoot = process.cwd();
const host = option("--host", "127.0.0.1");
const port = Number(option("--port", "5173"));
const headless = process.argv.includes("--headless");
const now = new Date().toISOString();
const runtimeDir = path.join(appRoot, ".aperture", "runtime");

fs.mkdirSync(runtimeDir, { recursive: true });
fs.writeFileSync(path.join(runtimeDir, "session.json"), JSON.stringify({
  protocolVersion: 1,
  appRoot,
  url: \`http://\${host}:\${port}/\`,
  host,
  port,
  startedAt: now,
  updatedAt: now,
  daemon: { pid: process.pid, state: "running" },
  server: { pid: null, state: "running" },
  browser: {
    pid: null,
    state: "running",
    cdpPort: null,
    cdpUrl: null,
    headless,
  },
  bridge: {
    statusGlobal: "__APERTURE_GENERATED_APP__",
    managedGlobal: "__APERTURE_MCP_MANAGED__",
    runtimeGlobal: "__APERTURE_MCP_RUNTIME__",
    url: \`ws://\${host}:\${port}/\`,
    channel: "aperture:devtools",
  },
  logs: {
    daemon: path.join(runtimeDir, "daemon.log"),
    server: path.join(runtimeDir, "server.log"),
    browser: path.join(runtimeDir, "browser.log"),
  },
  owned: true,
}, null, 2) + "\\n", "utf8");
setInterval(() => {}, 1000);
`,
    "utf8",
  );

  return entryPoint;
}

async function listenOnEphemeralPort(
  server: net.Server,
  host: string,
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected test server to bind to a TCP port.");
  }

  return address.port;
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

async function runCli(
  argv: readonly string[],
  cwd: string,
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runApertureCli({
    argv,
    cwd,
    entryPoint: "/tmp/aperture-test-bin.js",
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });

  return { exitCode, stdout, stderr };
}
