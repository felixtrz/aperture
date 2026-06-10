import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
export const APERTURE_RUNTIME_DIRECTORY = ".aperture/runtime";
export const APERTURE_SESSION_FILE = "session.json";
const APERTURE_DEVTOOLS_WS_CHANNEL = "aperture:devtools";
export const APERTURE_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";

export type ApertureProcessState =
  | "starting"
  | "running"
  | "stopped"
  | "failed"
  | "unknown";

export interface ApertureDevSessionLogFiles {
  readonly daemon: string;
  readonly server: string;
  readonly browser: string;
}

export interface ApertureDevSessionProcess {
  readonly pid: number | null;
  readonly state: ApertureProcessState;
}

export interface ApertureDevSessionBrowser extends ApertureDevSessionProcess {
  readonly cdpPort: number | null;
  readonly cdpUrl: string | null;
  readonly headless: boolean;
}

export interface ApertureDevSessionBridge {
  readonly statusGlobal: typeof APERTURE_STATUS_GLOBAL;
  readonly managedGlobal: typeof APERTURE_MCP_MANAGED_GLOBAL;
  readonly runtimeGlobal?: typeof APERTURE_MCP_RUNTIME_GLOBAL;
  readonly url?: string | null;
  readonly channel?: typeof APERTURE_DEVTOOLS_WS_CHANNEL;
}

export interface ApertureDevSession {
  readonly protocolVersion: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  readonly appRoot: string;
  readonly url: string;
  readonly host: string;
  readonly port: number;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly daemon: ApertureDevSessionProcess;
  readonly server: ApertureDevSessionProcess;
  readonly browser: ApertureDevSessionBrowser;
  readonly bridge: ApertureDevSessionBridge;
  readonly logs: ApertureDevSessionLogFiles;
  readonly owned: boolean;
}

export interface ApertureDevSessionStatus {
  readonly session: ApertureDevSession | null;
  readonly sessionFile: string;
  readonly daemonAlive: boolean;
  readonly serverAlive: boolean;
  readonly browserAlive: boolean;
}

export function apertureRuntimeDir(appRoot: string): string {
  return path.join(appRoot, APERTURE_RUNTIME_DIRECTORY);
}

export function apertureSessionFile(appRoot: string): string {
  return path.join(apertureRuntimeDir(appRoot), APERTURE_SESSION_FILE);
}

export async function readApertureDevSession(
  appRoot: string,
): Promise<ApertureDevSession | null> {
  try {
    const source = await readFile(apertureSessionFile(appRoot), "utf8");
    const parsed = JSON.parse(source) as unknown;

    return isApertureDevSession(parsed) ? parsed : null;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
}

export async function writeApertureDevSession(
  session: ApertureDevSession,
): Promise<void> {
  const sessionFile = apertureSessionFile(session.appRoot);
  // The daemon rewrites this file while `aperture dev`/MCP commands read it;
  // write-then-rename keeps every read a complete JSON document instead of
  // surfacing "Unexpected end of JSON input" from a half-flushed write.
  const temporaryFile = `${sessionFile}.${process.pid}.tmp`;

  await mkdir(path.dirname(sessionFile), { recursive: true });
  await writeFile(
    temporaryFile,
    `${JSON.stringify(session, null, 2)}\n`,
    "utf8",
  );

  try {
    await rename(temporaryFile, sessionFile);
  } catch (error: unknown) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

export async function clearApertureDevSession(appRoot: string): Promise<void> {
  await rm(apertureSessionFile(appRoot), { force: true });
}

export async function readApertureDevSessionStatus(
  appRoot: string,
): Promise<ApertureDevSessionStatus> {
  const session = await readApertureDevSession(appRoot);
  const daemonAlive = isProcessAlive(session?.daemon.pid ?? null);
  const browserPid = session?.browser.pid ?? null;
  const browserAlive =
    browserPid === null
      ? await isBrowserEndpointAlive(session, daemonAlive)
      : isProcessAlive(browserPid);

  return {
    session,
    sessionFile: apertureSessionFile(appRoot),
    daemonAlive,
    serverAlive: isProcessAlive(session?.server.pid ?? null),
    browserAlive,
  };
}

export function createApertureDevSession(input: {
  readonly appRoot: string;
  readonly url: string;
  readonly host: string;
  readonly port: number;
  readonly daemonPid: number | null;
  readonly serverPid: number | null;
  readonly browserPid: number | null;
  readonly browserCdpPort: number | null;
  readonly browserHeadless: boolean;
  readonly daemonState: ApertureProcessState;
  readonly serverState: ApertureProcessState;
  readonly browserState: ApertureProcessState;
  readonly logs: ApertureDevSessionLogFiles;
  readonly startedAt?: string;
  readonly bridgeUrl?: string | null;
}): ApertureDevSession {
  const now = new Date().toISOString();
  const cdpUrl =
    input.browserCdpPort === null
      ? null
      : `http://${input.host}:${input.browserCdpPort}`;

  return {
    protocolVersion: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    appRoot: input.appRoot,
    url: input.url,
    host: input.host,
    port: input.port,
    startedAt: input.startedAt ?? now,
    updatedAt: now,
    daemon: {
      pid: input.daemonPid,
      state: input.daemonState,
    },
    server: {
      pid: input.serverPid,
      state: input.serverState,
    },
    browser: {
      pid: input.browserPid,
      state: input.browserState,
      cdpPort: input.browserCdpPort,
      cdpUrl,
      headless: input.browserHeadless,
    },
    bridge: {
      statusGlobal: APERTURE_STATUS_GLOBAL,
      managedGlobal: APERTURE_MCP_MANAGED_GLOBAL,
      runtimeGlobal: APERTURE_MCP_RUNTIME_GLOBAL,
      url: input.bridgeUrl ?? `ws://${input.host}:${input.port}/`,
      channel: APERTURE_DEVTOOLS_WS_CHANNEL,
    },
    logs: input.logs,
    owned: true,
  };
}

export function isProcessAlive(pid: number | null): boolean {
  if (pid === null || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ESRCH")) {
      return false;
    }

    return true;
  }
}

/**
 * Best-effort process termination. Sending a signal to a pid can fail because
 * the process already exited (ESRCH) or because we are not permitted to signal
 * it (EPERM — e.g. a reparented child on a CI runner); neither is an error for
 * session cleanup, so swallow both and report delivery via the return value.
 * Any other error (an invalid signal) still throws.
 */
export function terminateProcess(
  pid: number | null,
  signal: NodeJS.Signals = "SIGTERM",
): boolean {
  if (pid === null || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, signal);
    return true;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ESRCH") || isNodeErrorCode(error, "EPERM")) {
      return false;
    }

    throw error;
  }
}

function isApertureDevSession(value: unknown): value is ApertureDevSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["protocolVersion"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
    typeof value["appRoot"] === "string" &&
    typeof value["url"] === "string" &&
    typeof value["host"] === "string" &&
    typeof value["port"] === "number" &&
    isRecord(value["daemon"]) &&
    isRecord(value["server"]) &&
    isRecord(value["browser"]) &&
    isRecord(value["bridge"]) &&
    isRecord(value["logs"])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}

async function isBrowserEndpointAlive(
  session: ApertureDevSession | null,
  daemonAlive: boolean,
): Promise<boolean> {
  if (session?.browser.state !== "running" || !daemonAlive) {
    return false;
  }

  if (session.browser.cdpUrl === null) {
    return true;
  }

  try {
    return await isHttpEndpointAlive(
      new URL("/json/version", session.browser.cdpUrl),
    );
  } catch {
    return false;
  }
}

async function isHttpEndpointAlive(url: URL): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    await response.body?.cancel();

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
