import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
export const APERTURE_RUNTIME_DIRECTORY = ".aperture/runtime";
export const APERTURE_SESSION_FILE = "session.json";

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
  readonly statusGlobal: "__APERTURE_GENERATED_APP__";
  readonly managedGlobal: "__APERTURE_MCP_MANAGED__";
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

  await mkdir(path.dirname(sessionFile), { recursive: true });
  await writeFile(sessionFile, `${JSON.stringify(session, null, 2)}\n`, "utf8");
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

  return {
    session,
    sessionFile: apertureSessionFile(appRoot),
    daemonAlive,
    serverAlive: isProcessAlive(session?.server.pid ?? null),
    browserAlive:
      browserPid === null
        ? session?.browser.state === "running" && daemonAlive
        : isProcessAlive(browserPid),
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
      statusGlobal: "__APERTURE_GENERATED_APP__",
      managedGlobal: "__APERTURE_MCP_MANAGED__",
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
