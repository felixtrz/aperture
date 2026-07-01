import type { ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  apertureRuntimeDir,
  createApertureDevSession,
  writeApertureDevSession,
} from "../session.js";
import { assertApertureDevAppRoot } from "./app-root.js";
import { launchManagedBrowser } from "./browser.js";
import { resolveApertureGpu } from "./gpu.js";
import {
  appendLog,
  closeApertureDevLogStreams,
  logFiles,
  openApertureDevLogStreams,
} from "./logs.js";
import { findAvailablePort, resolveApertureDevServerPort } from "./ports.js";
import { stopChild } from "./process.js";
import { startViteServer, waitForHttp } from "./server.js";
import {
  hasDisplay,
  startVirtualDisplay,
  type VirtualDisplay,
} from "./xvfb.js";
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_TIMEOUT_MS,
  type ApertureDevDaemonOptions,
  type ManagedBrowser,
} from "./types.js";

export async function runApertureDevSessionDaemon(
  options: ApertureDevDaemonOptions,
): Promise<void> {
  const appRoot = path.resolve(options.cwd);
  await assertApertureDevAppRoot(appRoot);

  const host = options.host ?? DEFAULT_HOST;
  const port = await resolveApertureDevServerPort({
    host,
    port: options.port ?? DEFAULT_PORT,
    strictPort: options.strictPort !== false,
  });
  const url = `http://${host}:${port}/`;
  const gpu = resolveApertureGpu({
    ...(options.gpu === undefined ? {} : { mode: options.gpu }),
  });
  // Headless Chrome does not composite SwiftShader WebGPU into screenshots or
  // pixel readbacks, so software rendering must run headed (with a virtual
  // display on GPU-less Linux). On a hardware GPU we honor the requested mode.
  const headless = gpu.software
    ? false
    : (options.headless ?? options.open !== true);
  const logs = logFiles(appRoot);
  const startedAt = new Date().toISOString();

  await mkdir(apertureRuntimeDir(appRoot), { recursive: true });
  await writeApertureDevSession(
    createApertureDevSession({
      appRoot,
      url,
      host,
      port,
      daemonPid: process.pid,
      serverPid: null,
      browserPid: null,
      browserCdpPort: null,
      browserHeadless: headless,
      daemonState: "starting",
      serverState: "starting",
      browserState: "starting",
      logs,
      startedAt,
    }),
  );

  const streams = openApertureDevLogStreams(logs);
  let server: ChildProcess | null = null;
  let browser: ManagedBrowser | null = null;
  let display: VirtualDisplay | null = null;

  const writeSession = async (input: {
    readonly serverState: "starting" | "running" | "stopped" | "failed";
    readonly browserState: "starting" | "running" | "stopped" | "failed";
    readonly browserPid?: number | null;
    readonly browserCdpPort?: number | null;
  }): Promise<void> => {
    await writeApertureDevSession(
      createApertureDevSession({
        appRoot,
        url,
        host,
        port,
        daemonPid: process.pid,
        serverPid: server?.pid ?? null,
        browserPid: input.browserPid ?? browser?.pid ?? null,
        browserCdpPort: input.browserCdpPort ?? null,
        browserHeadless: headless,
        daemonState: "running",
        serverState: input.serverState,
        browserState: input.browserState,
        logs,
        startedAt,
      }),
    );
  };

  const stop = async (): Promise<void> => {
    await appendLog(streams.daemon, "Stopping Aperture dev session.");
    await writeSession({
      serverState: server?.exitCode === null ? "stopped" : "failed",
      browserState: "stopped",
      browserPid: browser?.pid ?? null,
    });
    await browser?.close();
    stopChild(server);
    await display?.close();
    await closeApertureDevLogStreams(streams);
    process.exitCode = 0;
    process.exit();
  };

  process.once("SIGTERM", () => {
    void stop();
  });
  process.once("SIGINT", () => {
    void stop();
  });

  try {
    await appendLog(streams.daemon, `Starting Vite at ${url}`);
    server = startViteServer({
      cwd: appRoot,
      host,
      port,
      strictPort: options.strictPort !== false,
      log: streams.server,
    });
    await writeSession({ serverState: "starting", browserState: "starting" });
    await waitForHttp(url, DEFAULT_TIMEOUT_MS);
    await writeSession({ serverState: "running", browserState: "starting" });

    const browserCdpPort = await findAvailablePort(port + 1_000, host);
    await appendLog(
      streams.daemon,
      `WebGPU backend: ${gpu.software ? "software (SwiftShader)" : "hardware"} — ${gpu.reason} [${gpu.source}]`,
    );

    // Software WebGPU runs headed; on GPU-less Linux without an existing X
    // display, spin up an Xvfb virtual display so the user does not have to
    // wrap the command in xvfb-run.
    let browserEnv: NodeJS.ProcessEnv | undefined;
    if (
      gpu.software &&
      process.platform === "linux" &&
      !hasDisplay(process.env)
    ) {
      display = await startVirtualDisplay({ log: streams.browser });
      browserEnv = { ...process.env, DISPLAY: display.display };
      await appendLog(
        streams.daemon,
        `Started Xvfb virtual display ${display.display} for headed software rendering.`,
      );
    }

    browser = await launchManagedBrowser({
      url,
      host,
      cdpPort: browserCdpPort,
      headless,
      software: gpu.software,
      ...(browserEnv === undefined ? {} : { env: browserEnv }),
      log: streams.browser,
    });
    await writeSession({
      serverState: "running",
      browserState: "running",
      browserPid: browser.pid,
      browserCdpPort,
    });
    await appendLog(streams.daemon, "Aperture dev session is ready.");
  } catch (error: unknown) {
    await appendLog(
      streams.daemon,
      `Aperture dev session failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    await writeApertureDevSession(
      createApertureDevSession({
        appRoot,
        url,
        host,
        port,
        daemonPid: process.pid,
        serverPid: server?.pid ?? null,
        browserPid: browser?.pid ?? null,
        browserCdpPort: null,
        browserHeadless: headless,
        daemonState: "failed",
        serverState: server === null ? "failed" : "unknown",
        browserState: "failed",
        logs,
        startedAt,
      }),
    );
    await browser?.close();
    stopChild(server);
    await display?.close();
    await closeApertureDevLogStreams(streams);
    process.exitCode = 1;
    return;
  }

  await new Promise(() => undefined);
}
