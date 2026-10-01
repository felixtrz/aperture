import { spawn } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { headlessLifecycleFixture } from "../helpers/headless-lifecycle-fixture.js";
import { waitFor } from "../helpers/wait.js";

const CLI_BIN = fileURLToPath(
  new URL("../../packages/cli/dist/bin/aperture.js", import.meta.url),
);

it.each([
  { name: "success", commandFails: false, cleanupFails: false },
  { name: "bundle write failure", commandFails: true, cleanupFails: false },
  {
    name: "command and cleanup failures",
    commandFails: true,
    cleanupFails: true,
  },
  { name: "cleanup-only failure", commandFails: false, cleanupFails: true },
])(
  "awaits native one-shot system and feature cleanup after $name",
  async ({ commandFails, cleanupFails }) => {
    await expect(
      stat(CLI_BIN),
      "Run pnpm build before native CLI tests.",
    ).resolves.toBeDefined();
    const fixture = await headlessLifecycleFixture(cleanupFails);
    const out = commandFails
      ? fixture.badOutput
      : path.join(fixture.root, "frame.bundle.json");
    const child = spawn(
      process.execPath,
      [
        CLI_BIN,
        "headless",
        fixture.config,
        "--out",
        out,
        "--frames",
        "1",
        "--json",
      ],
      {
        cwd: fixture.root,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let closed = false;
    const errors: Error[] = [];
    child.stdout.setEncoding("utf8").on("data", (text: string) => {
      stdout += text;
    });
    child.stderr.setEncoding("utf8").on("data", (text: string) => {
      stderr += text;
    });
    child.on("error", (error) => {
      errors.push(error);
    });
    child.on("close", () => {
      closed = true;
    });
    try {
      await waitFor(() => closed, {
        timeoutMs: 30_000,
        label: "native one-shot runner cleanup and exit",
      });
      expect(errors).toEqual([]);
      expect(
        { code: child.exitCode, signal: child.signalCode },
        stderr,
      ).toEqual({ code: commandFails || cleanupFails ? 1 : 0, signal: null });
      expect(await readFile(fixture.marker, "utf8")).toBe("system\nfeature\n");
      if (commandFails) {
        expect(stdout).toBe("");
        expect(stderr).toContain(fixture.badOutput);
        expect(stderr).not.toContain(
          "Failed to dispose the headless command runner:",
        );
        if (cleanupFails) {
          expect(stderr).toContain("system cleanup failure");
          expect(stderr).toContain("feature cleanup failure");
        }
      } else {
        expect(JSON.parse(stdout).nextFrame).toBe(1);
        expect(JSON.parse(await readFile(out, "utf8")).format).toBe(
          "aperture.render-bundle",
        );
        if (cleanupFails)
          expect(stderr).toContain(
            "Failed to dispose the headless command runner:",
          );
      }
    } finally {
      if (!closed) {
        // Only this test-owned child is signaled if a lifecycle regression hangs.
        child.kill("SIGKILL");
        await waitFor(() => closed, {
          label: "test-owned one-shot child termination",
        });
      }
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
  60_000,
);
