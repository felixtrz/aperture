import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadApertureHeadlessApp } from "@aperture-engine/cli";
import { createHeadlessViteRuntime } from "../../packages/cli/src/headless/vite-runtime.js";

// These tests deliberately avoid loading the engine through the runtime: doing
// so in-process would register ECS components a second time and collide with
// the source copy other test files load in the same vitest worker. The real
// engine-loading path is verified by the `aperture headless` subprocess tests.

const FIXTURE_DIR = fileURLToPath(
  new URL("../fixtures/headless-procedural", import.meta.url),
);

describe("createHeadlessViteRuntime (P1.2)", () => {
  it("transforms and imports a TypeScript module in pure Node", async () => {
    const runtime = await createHeadlessViteRuntime({ root: FIXTURE_DIR });

    try {
      const moduleRecord = await runtime.importModule(
        path.join(FIXTURE_DIR, "plain-module.ts"),
      );
      expect(moduleRecord["plainValue"]).toBe(42);
      expect(
        (moduleRecord["plainGreeting"] as (name: string) => string)("world"),
      ).toBe("hello world");
    } finally {
      await runtime.dispose();
    }
  });
});

describe("loadApertureHeadlessApp error paths (P1.2)", () => {
  it("rejects a missing config before starting a Vite server", async () => {
    await expect(
      loadApertureHeadlessApp({
        configFile: path.join(FIXTURE_DIR, "does-not-exist.config.ts"),
      }),
    ).rejects.toMatchObject({ code: "aperture.headless.configNotFound" });
  });
});
