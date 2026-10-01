import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { evaluateConfigTypeMetadata } from "../../packages/vite-plugin/src/config-type-evaluation.js";
import { waitForFile } from "../helpers/wait.js";

it("terminates a real worker whose config never finishes evaluating", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "aperture-codegen-timeout-"),
  );
  const config = path.join(root, "config.mjs");
  const started = path.join(root, "started.txt");
  await writeFile(
    config,
    `
    import { writeFileSync } from "node:fs";
    setInterval(() => {}, 1000);
    writeFileSync(${JSON.stringify(started)}, "started");
    await new Promise(() => {});
    export default {};
  `,
  );
  const realSetTimeout = globalThis.setTimeout;
  let expire: (() => void) | undefined;
  const timers = vi
    .spyOn(globalThis, "setTimeout")
    .mockImplementation((callback, delay, ...args) => {
      if (delay === 30_000) expire = () => callback(...args);
      return realSetTimeout(callback, delay, ...args);
    });
  const result = evaluateConfigTypeMetadata(config);
  try {
    // Trigger the actual deadline handler only after the real worker reached
    // its blocked import. Polling still uses normal timers and a generous cap.
    expect(await waitForFile(started, { timeoutMs: 10_000 })).toBe("started");
    expect(expire).toBeDefined();
    expire?.();
    expect(await result).toBeNull();
  } finally {
    expire?.();
    await result;
    timers.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
}, 45_000);
