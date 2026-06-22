import { spawn, type ChildProcess } from "node:child_process";
import type { WriteStream } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { VITE_CONFIG_FILE } from "./types.js";
import { delay, pipeChildOutput } from "./process.js";

export function startViteServer(input: {
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

export async function waitForHttp(
  url: string,
  timeoutMs: number,
): Promise<void> {
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

function resolveViteBin(): string {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("vite/package.json");

  return path.join(path.dirname(packageJson), "bin/vite.js");
}
