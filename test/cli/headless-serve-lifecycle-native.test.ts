import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { waitFor } from "../helpers/wait.js";

const CLI_BIN = fileURLToPath(
  new URL("../../packages/cli/dist/bin/aperture.js", import.meta.url),
);

// The real serve process must release this feature-owned timer before it can
// exit. No Vitest module aliases or resource mocks run inside the child.
it.each(["EOF", "shutdown"])(
  "exits native headless serve on %s after asynchronous cleanup",
  async (mode) => {
    await expect(
      stat(CLI_BIN),
      "Run pnpm build before native CLI tests.",
    ).resolves.toBeDefined();
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-serve-native-lifecycle-"),
    );
    const marker = path.join(root, "disposed.txt");
    await writeFile(
      path.join(root, "aperture.headless.config.ts"),
      `
    import { writeFile } from "node:fs/promises";
    export default { mode: "headless", systems: [], features: [{
      id: "owned-timer",
      installRuntime() {
        const timer = setInterval(() => {}, 1000);
        return async () => {
          clearInterval(timer);
          await writeFile(${JSON.stringify(marker)}, "disposed");
        };
      },
    }] };
  `,
    );
    const child = spawn(
      process.execPath,
      [CLI_BIN, "headless", "serve", "aperture.headless.config.ts"],
      {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let closed = false;
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("close", () => {
      closed = true;
    });
    const errors: Error[] = [];
    child.on("error", (error) => {
      errors.push(error);
    });
    child.stdin.on("error", (error) => {
      errors.push(error);
    });
    try {
      if (mode === "EOF") {
        child.stdin.end('{"id":1,"cmd":"step"}\n');
      } else {
        // Keep input open: shutdown must pause it so the real CLI can exit.
        child.stdin.write('{"id":1,"cmd":"shutdown"}\n');
      }
      await waitFor(() => closed, {
        timeoutMs: 30_000,
        label: "native headless serve cleanup and exit",
      });
      expect(errors).toEqual([]);
      expect(
        { code: child.exitCode, signal: child.signalCode },
        stderr,
      ).toEqual({
        code: 0,
        signal: null,
      });
      const responses = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(responses[0].ready).toBe(true);
      expect(responses[1]).toMatchObject({ id: 1, ok: true });
      expect(await readFile(marker, "utf8")).toBe("disposed");
    } finally {
      if (!closed) {
        // Signal only the process created by this test, never a fabricated PID.
        child.kill("SIGKILL");
        await waitFor(() => closed, {
          label: "test-owned native serve cleanup",
        });
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  60_000,
);
