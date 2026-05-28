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
  const headless = options.headless ?? options.open !== true;
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
    browser = await launchManagedBrowser({
      url,
      host,
      cdpPort: browserCdpPort,
      headless,
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
    await closeApertureDevLogStreams(streams);
    process.exitCode = 1;
    return;
  }

  await new Promise(() => undefined);
}
