import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ApertureCliError, loadApertureHeadlessApp } from "@aperture-engine/cli";

// With the native TypeScript loader (no Vite SSR runner), the config + systems
// resolve the engine to the SAME module instances the test process already
// holds — so this runs in-process with no "Component already exists" collision,
// unlike the old Vite-runner path that had to be tested out of process.

function fixture(relativePath: string): string {
  return fileURLToPath(new URL(`../fixtures/${relativePath}`, import.meta.url));
}

describe("loadApertureHeadlessApp (native loader, PA.1/PA.4)", () => {
  it("loads a procedural headless config and discovers its systems", async () => {
    const loaded = await loadApertureHeadlessApp({
      configFile: fixture("headless-procedural/aperture.headless.config.ts"),
    });

    expect(loaded.config.mode).toBe("headless");
    expect(loaded.systems.length).toBe(1);
    expect(typeof loaded.systems[0]?.default).toBe("function");
    expect(loaded.diagnostics).toEqual([]);
  });

  it("rejects a config whose mode is not headless", async () => {
    await expect(
      loadApertureHeadlessApp({
        configFile: fixture("headless-procedural/aperture.browser.config.ts"),
      }),
    ).rejects.toMatchObject({ code: "aperture.headless.invalidMode" });
  });

  it("rejects a missing config path with an ApertureCliError", async () => {
    const promise = loadApertureHeadlessApp({
      configFile: fixture("headless-procedural/does-not-exist.config.ts"),
    });
    await expect(promise).rejects.toBeInstanceOf(ApertureCliError);
    await expect(promise).rejects.toMatchObject({
      code: "aperture.headless.configNotFound",
    });
  });

  it("surfaces a discovery diagnostic for a system without a default export", async () => {
    const loaded = await loadApertureHeadlessApp({
      configFile: fixture("headless-bad-system/aperture.headless.config.ts"),
    });

    expect(loaded.systems).toEqual([]);
    expect(
      loaded.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "aperture.system.missingDefaultExport",
      ),
    ).toBe(true);
  });
});
