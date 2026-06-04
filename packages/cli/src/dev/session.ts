import { spawn } from "node:child_process";
import path from "node:path";
import {
  clearApertureDevSession,
  isProcessAlive,
  readApertureDevSession,
  readApertureDevSessionStatus,
  terminateProcess,
  type ApertureDevSession,
  type ApertureDevSessionStatus,
} from "../session.js";
import { assertApertureDevAppRoot } from "./app-root.js";
import { delay, waitForProcessExit } from "./process.js";
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_TIMEOUT_MS,
  type ApertureDevDownOptions,
  type ApertureDevDownReport,
  type ApertureDevUpOptions,
  type ApertureDevUpReport,
} from "./types.js";

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
    terminateProcess(status.session.daemon.pid);
    await waitForProcessExit(
      status.session.daemon.pid,
      options.timeoutMs ?? 5_000,
    );
  }

  const serverPid = status.session.server.pid;
  if (isProcessAlive(serverPid) && serverPid !== null) {
    terminateProcess(serverPid);
  }

  const browserPid = status.session.browser.pid;
  if (isProcessAlive(browserPid) && browserPid !== null) {
    terminateProcess(browserPid);
  }

  await clearApertureDevSession(appRoot);

  return { hadSession: true, stopped: true };
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
