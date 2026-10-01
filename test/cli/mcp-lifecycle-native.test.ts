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

// Exercise the built Node CLI without Vitest aliases or renderer mocks. The
// feature owns a real live timer; EOF must dispose it before Node can exit.
it.each(["EOF", "output failure"])(
  "exits native MCP on %s after awaiting an async headless feature cleanup",
  async (mode) => {
    await expect(
      stat(CLI_BIN),
      "Run pnpm build before native CLI tests.",
    ).resolves.toBeDefined();
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-mcp-native-lifecycle-"),
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
    const child = spawn(process.execPath, [CLI_BIN, "mcp", "stdio"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
      const startRequest = `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "app_start",
          arguments: {
            target: "headless",
            config: "aperture.headless.config.ts",
          },
        },
      })}\n`;
      if (mode === "EOF") {
        child.stdin.end(startRequest);
      } else {
        child.stdin.write(startRequest);
        await waitFor(() => stdout.includes("\n"), {
          timeoutMs: 30_000,
          label: "native MCP app_start response",
        });
        // Close the real output pipe, then request a response without ending
        // stdin. An EPIPE must still release the timer and let the CLI exit.
        child.stdout.destroy();
        child.stdin.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: "app_status", arguments: { target: "headless" } },
          })}\n`,
        );
      }
      await waitFor(() => closed, {
        timeoutMs: 30_000,
        label: "native MCP EOF cleanup and exit",
      });
      expect(errors).toEqual([]);
      expect(
        { code: child.exitCode, signal: child.signalCode },
        stderr,
      ).toEqual({
        code: mode === "EOF" ? 0 : 1,
        signal: null,
      });
      expect(JSON.parse(stdout).result.structuredContent).toMatchObject({
        ok: true,
        target: "headless",
      });
      expect(await readFile(marker, "utf8")).toBe("disposed");
    } finally {
      if (!closed) {
        // Signal only the process created by this test, never a fabricated PID.
        child.kill("SIGKILL");
        await waitFor(() => closed, { label: "test-owned native MCP cleanup" });
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  60_000,
);
