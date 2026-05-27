import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apertureRuntimeDir,
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

  it("serves MCP initialize, tools/list, and missing-session tool diagnostics over stdio", async () => {
    const root = await tempRoot();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: string[] = [];

    stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    const done = runApertureMcpServer({ cwd: root, stdin, stdout });

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
          name: "browser_status",
          arguments: {},
        },
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

    expect(initialize?.result).toMatchObject({
      capabilities: { tools: {} },
      serverInfo: { name: "aperture" },
    });
    expect(toolNames(tools?.result)).toEqual([
      "browser_status",
      "browser_screenshot",
      "browser_console_logs",
      "browser_reload",
      "browser_wait_for_webgpu",
      "browser_pick_pixel",
      "ecs_find_entities",
      "ecs_get_entity",
      "ecs_query",
      "ecs_get_component_schema",
      "ecs_snapshot",
      "ecs_diff",
      "ecs_list_systems",
      "ecs_pause",
      "ecs_resume",
      "ecs_step",
      "ecs_set_component_field",
      "ecs_get_hierarchy",
      "input_key",
      "input_pointer_move",
      "input_pointer_click",
      "input_drag",
      "input_action_set",
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
      "render_get_frame_report",
      "render_get_snapshot_summary",
      "render_get_packets",
      "render_explain_entity",
      "render_get_diagnostics",
      "render_readback_samples",
      "render_pick_entity",
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
    headless: true,
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
