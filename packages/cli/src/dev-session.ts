import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import {
  apertureRuntimeDir,
  clearApertureDevSession,
  createApertureDevSession,
  isProcessAlive,
  readApertureDevSession,
  readApertureDevSessionStatus,
  writeApertureDevSession,
  type ApertureDevSession,
  type ApertureDevSessionLogFiles,
  type ApertureDevSessionStatus,
} from "./session.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 5173;
const DEFAULT_TIMEOUT_MS = 30_000;
const VITE_CONFIG_FILE = "vite.config.ts";

export class ApertureDevSessionError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.name = "ApertureDevSessionError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export interface ApertureDevUpOptions {
  readonly cwd: string;
  readonly entryPoint: string;
  readonly host?: string;
  readonly port?: number;
  readonly open?: boolean;
  readonly headless?: boolean;
  readonly strictPort?: boolean;
  readonly timeoutMs?: number;
}

export interface ApertureDevDaemonOptions {
  readonly cwd: string;
  readonly host?: string;
  readonly port?: number;
  readonly open?: boolean;
  readonly headless?: boolean;
  readonly strictPort?: boolean;
}

export interface ApertureDevDownOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
}

export interface ApertureDevLogsOptions {
  readonly cwd: string;
  readonly lines?: number;
}

export interface ApertureDevUpReport {
  readonly session: ApertureDevSession;
  readonly reused: boolean;
}

export interface ApertureDevDownReport {
  readonly hadSession: boolean;
  readonly stopped: boolean;
}

export interface ApertureDevLogsReport {
  readonly session: ApertureDevSession | null;
  readonly logs: readonly {
    readonly name: keyof ApertureDevSessionLogFiles;
    readonly file: string;
    readonly text: string;
  }[];
}

export interface ResolveApertureDevServerPortOptions {
  readonly host: string;
  readonly port: number;
  readonly strictPort: boolean;
}

interface ManagedBrowser {
  readonly pid: number | null;
  readonly close: () => Promise<void>;
}

export async function startApertureDevSession(
  options: ApertureDevUpOptions,
): Promise<ApertureDevUpReport> {
  const appRoot = path.resolve(options.cwd);
  await assertApertureDevAppRoot(appRoot);

  const status = await readApertureDevSessionStatus(appRoot);

  if (
    status.session !== null &&
    status.daemonAlive &&
    status.serverAlive &&
    status.browserAlive
  ) {
    return { session: status.session, reused: true };
  }

  if (status.session !== null) {
    await stopApertureDevSession({ cwd: appRoot });
  } else {
    await clearApertureDevSession(appRoot);
  }
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const args = [
    options.entryPoint,
    "dev",
    "daemon",
    "--host",
    host,
    "--port",
    String(port),
  ];

  if (options.open === true) {
    args.push("--open");
  }

  if (options.headless === true || options.open !== true) {
    args.push("--headless");
  }

  if (options.strictPort === false) {
    args.push("--no-strict-port");
  } else {
    args.push("--strict-port");
  }

  const child = spawn(process.execPath, args, {
    cwd: appRoot,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  const session = await waitForSessionReady({
    cwd: appRoot,
    daemonPid: child.pid ?? null,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return { session, reused: false };
}

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

  const daemonLog = createWriteStream(logs.daemon, { flags: "a" });
  const serverLog = createWriteStream(logs.server, { flags: "a" });
  const browserLog = createWriteStream(logs.browser, { flags: "a" });
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
    await appendLog(daemonLog, "Stopping Aperture dev session.");
    await writeSession({
      serverState: server?.exitCode === null ? "stopped" : "failed",
      browserState: "stopped",
      browserPid: browser?.pid ?? null,
    });
    await browser?.close();
    stopChild(server);
    await closeStream(daemonLog);
    await closeStream(serverLog);
    await closeStream(browserLog);
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
    await appendLog(daemonLog, `Starting Vite at ${url}`);
    server = startViteServer({
      cwd: appRoot,
      host,
      port,
      strictPort: options.strictPort !== false,
      log: serverLog,
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
      log: browserLog,
    });
    await writeSession({
      serverState: "running",
      browserState: "running",
      browserPid: browser.pid,
      browserCdpPort,
    });
    await appendLog(daemonLog, "Aperture dev session is ready.");
  } catch (error: unknown) {
    await appendLog(
      daemonLog,
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
    await closeStream(daemonLog);
    await closeStream(serverLog);
    await closeStream(browserLog);
    process.exitCode = 1;
    return;
  }

  await new Promise(() => undefined);
}

export async function resolveApertureDevServerPort(
  options: ResolveApertureDevServerPortOptions,
): Promise<number> {
  if (options.strictPort) {
    return options.port;
  }

  return findAvailablePort(options.port, options.host);
}

export async function readApertureDevStatus(
  cwd: string,
): Promise<ApertureDevSessionStatus> {
  return readApertureDevSessionStatus(path.resolve(cwd));
}

export async function stopApertureDevSession(
  options: ApertureDevDownOptions,
): Promise<ApertureDevDownReport> {
  const appRoot = path.resolve(options.cwd);
  const status = await readApertureDevSessionStatus(appRoot);

  if (status.session === null) {
    return { hadSession: false, stopped: false };
  }

  if (status.daemonAlive && status.session.daemon.pid !== null) {
    process.kill(status.session.daemon.pid, "SIGTERM");
    await waitForProcessExit(
      status.session.daemon.pid,
      options.timeoutMs ?? 5_000,
    );
  }

  if (isProcessAlive(status.session.server.pid)) {
    process.kill(status.session.server.pid ?? 0, "SIGTERM");
  }

  if (isProcessAlive(status.session.browser.pid)) {
    process.kill(status.session.browser.pid ?? 0, "SIGTERM");
  }

  await clearApertureDevSession(appRoot);

  return { hadSession: true, stopped: true };
}

export async function readApertureDevLogs(
  options: ApertureDevLogsOptions,
): Promise<ApertureDevLogsReport> {
  const session = await readApertureDevSession(path.resolve(options.cwd));

  if (session === null) {
    return { session: null, logs: [] };
  }

  const lines = options.lines ?? 80;
  const entries = await Promise.all(
    (
      Object.entries(session.logs) as [
        keyof ApertureDevSessionLogFiles,
        string,
      ][]
    ).map(async ([name, file]) => ({
      name,
      file,
      text: await tailFile(file, lines),
    })),
  );

  return { session, logs: entries };
}

export async function openApertureDevSession(cwd: string): Promise<void> {
  const session = await readApertureDevSession(path.resolve(cwd));

  if (session === null) {
    throw new Error("No Aperture dev session exists. Run 'aperture dev up'.");
  }

  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", session.url]
      : [session.url];

  spawn(command, args, {
    detached: true,
    stdio: "ignore",
  }).unref();
}

async function waitForSessionReady(input: {
  readonly cwd: string;
  readonly daemonPid: number | null;
  readonly timeoutMs: number;
}): Promise<ApertureDevSession> {
  const deadline = Date.now() + input.timeoutMs;
  let lastSession: ApertureDevSession | null = null;

  while (Date.now() < deadline) {
    const session = await readApertureDevSession(input.cwd);
    lastSession = session;

    if (session?.daemon.state === "failed") {
      throw new Error(
        `Aperture dev daemon failed. See ${session.logs.daemon} for details.`,
      );
    }

    if (
      session?.server.state === "running" &&
      session.browser.state === "running"
    ) {
      return session;
    }

    if (
      input.daemonPid !== null &&
      !isProcessAlive(input.daemonPid) &&
      session === null
    ) {
      throw new Error("Aperture dev daemon exited before writing a session.");
    }

    await delay(100);
  }

  throw new Error(
    `Timed out waiting for Aperture dev session.${
      lastSession === null
        ? ""
        : ` Last session state: ${lastSession.daemon.state}.`
    }`,
  );
}

function startViteServer(input: {
  readonly cwd: string;
  readonly host: string;
  readonly port: number;
  readonly strictPort: boolean;
  readonly log: WriteStream;
}): ChildProcess {
  const viteBin = resolveViteBin();
  const args = [
    viteBin,
    "--host",
    input.host,
    "--port",
    String(input.port),
    "--config",
    VITE_CONFIG_FILE,
  ];

  if (input.strictPort) {
    args.push("--strictPort");
  }

  const child = spawn(process.execPath, args, {
    cwd: input.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  pipeChildOutput(child, input.log);
  return child;
}

async function assertApertureDevAppRoot(appRoot: string): Promise<void> {
  const configPath = path.join(appRoot, VITE_CONFIG_FILE);

  try {
    const configStat = await stat(configPath);

    if (configStat.isFile()) {
      return;
    }
  } catch (error: unknown) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  throw new ApertureDevSessionError(
    "aperture.dev.invalidAppRoot",
    `Expected an Aperture app root with ${VITE_CONFIG_FILE} at ${configPath}. Run this command from a generated Aperture app or pass the app root as the working directory.`,
  );
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}

function resolveViteBin(): string {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("vite/package.json");

  return path.join(path.dirname(packageJson), "bin/vite.js");
}

async function launchManagedBrowser(input: {
  readonly url: string;
  readonly host: string;
  readonly cdpPort: number;
  readonly headless: boolean;
  readonly log: WriteStream;
}): Promise<ManagedBrowser> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: input.headless,
    args: [
      `--remote-debugging-address=${input.host}`,
      `--remote-debugging-port=${input.cdpPort}`,
      "--enable-unsafe-webgpu",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });

  page.on("console", (message) => {
    void appendLog(input.log, `[${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    void appendLog(input.log, `[pageerror] ${error.stack ?? error.message}`);
  });
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "__APERTURE_MCP_MANAGED__", {
      configurable: true,
      value: true,
    });
  });
  await page.goto(input.url, { waitUntil: "domcontentloaded" });

  const processProvider = browser as unknown as {
    process?: () => { readonly pid?: number } | null;
  };
  const pid = processProvider.process?.()?.pid ?? null;

  return {
    pid,
    async close() {
      await browser.close();
    },
  };
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      await response.body?.cancel();
      if (response.ok) {
        return;
      }
    } catch (error: unknown) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(
    `Timed out waiting for Vite at ${url}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function findAvailablePort(start: number, host: string): Promise<number> {
  for (let port = start; port < start + 200; port += 1) {
    if (await canListen(port, host)) {
      return port;
    }
  }

  throw new Error(`Unable to find an available port starting at ${start}.`);
}

async function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function waitForProcessExit(
  pid: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return;
    }

    await delay(100);
  }
}

function stopChild(child: ChildProcess | null): void {
  if (child === null || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
}

function pipeChildOutput(child: ChildProcess, log: WriteStream): void {
  child.stdout?.on("data", (chunk: Buffer) => {
    log.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    log.write(chunk);
  });
}

async function tailFile(file: string, lines: number): Promise<string> {
  try {
    const source = await readFile(file, "utf8");
    const parts = source.split(/\r?\n/);
    if (parts.at(-1) === "") {
      parts.pop();
    }

    return parts.slice(Math.max(0, parts.length - lines)).join("\n");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) {
      return "";
    }

    throw error;
  }
}

function logFiles(appRoot: string): ApertureDevSessionLogFiles {
  const runtimeDir = apertureRuntimeDir(appRoot);

  return {
    daemon: path.join(runtimeDir, "daemon.log"),
    server: path.join(runtimeDir, "server.log"),
    browser: path.join(runtimeDir, "browser.log"),
  };
}

async function appendLog(log: WriteStream, line: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    log.write(`${new Date().toISOString()} ${line}\n`, (error) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

async function closeStream(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve) => {
    stream.end(resolve);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
