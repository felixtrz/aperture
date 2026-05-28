import type { ChildProcess } from "node:child_process";
import type { WriteStream } from "node:fs";
import { isProcessAlive } from "../session.js";

export async function waitForProcessExit(
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

export function stopChild(child: ChildProcess | null): void {
  if (child === null || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
}

export function pipeChildOutput(child: ChildProcess, log: WriteStream): void {
  child.stdout?.on("data", (chunk: Buffer) => {
    log.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    log.write(chunk);
  });
}

export function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
