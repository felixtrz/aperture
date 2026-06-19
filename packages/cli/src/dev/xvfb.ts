import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { WriteStream } from "node:fs";
import { appendLog } from "./logs.js";
import { isNodeErrorCode, pipeChildOutput } from "./process.js";

const X11_SOCKET_DIR = "/tmp/.X11-unix";
const READY_TIMEOUT_MS = 5_000;

export interface VirtualDisplay {
  /** Value to assign to the DISPLAY environment variable, e.g. ":99". */
  readonly display: string;
  /** Terminate the underlying Xvfb process. */
  readonly close: () => Promise<void>;
}

/**
 * Launch an Xvfb virtual framebuffer so a GPU-less Linux host (CI runner, dev
 * container) can run Chrome headed. SwiftShader WebGPU only composites into
 * Playwright screenshots/readbacks when the browser is headed, and headed Chrome
 * needs an X display — Xvfb provides one without real hardware.
 */
export async function startVirtualDisplay(input: {
  readonly log: WriteStream;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
}): Promise<VirtualDisplay> {
  const width = input.width ?? 1280;
  const height = input.height ?? 800;
  const depth = input.depth ?? 24;
  const displayNumber = pickFreeDisplayNumber();
  const display = `:${displayNumber}`;
  const socketPath = `${X11_SOCKET_DIR}/X${displayNumber}`;

  const child = spawn(
    "Xvfb",
    [display, "-screen", "0", `${width}x${height}x${depth}`, "-nolisten", "tcp"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  pipeChildOutput(child, input.log);

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  };

  try {
    await waitForDisplayReady(child, socketPath);
  } catch (error: unknown) {
    await close();
    if (isNodeErrorCode(error, "ENOENT")) {
      throw new Error(
        "Xvfb is not installed, so the managed browser cannot render software WebGPU. " +
          "Install it (e.g. 'apt-get install xvfb'), or set DISPLAY / run under 'xvfb-run'.",
        { cause: error },
      );
    }
    throw error;
  }

  await appendLog(
    input.log,
    `[xvfb] virtual display ready at ${display} (${width}x${height}x${depth})`,
  );

  return { display, close };
}

function waitForDisplayReady(
  child: ReturnType<typeof spawn>,
  socketPath: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null): void => {
      cleanup();
      reject(
        new Error(
          `Xvfb exited before the virtual display was ready (code ${code ?? "null"}).`,
        ),
      );
    };
    const cleanup = (): void => {
      child.off("error", onError);
      child.off("exit", onExit);
    };

    child.once("error", onError);
    child.once("exit", onExit);

    const poll = (): void => {
      if (existsSync(socketPath)) {
        cleanup();
        resolve();
        return;
      }
      if (Date.now() - start > READY_TIMEOUT_MS) {
        cleanup();
        reject(new Error(`Timed out waiting for the Xvfb display ${socketPath}.`));
        return;
      }
      setTimeout(poll, 100);
    };

    poll();
  });
}

function pickFreeDisplayNumber(): number {
  for (let candidate = 99; candidate <= 250; candidate += 1) {
    if (!existsSync(`${X11_SOCKET_DIR}/X${candidate}`)) {
      return candidate;
    }
  }
  return 99;
}
