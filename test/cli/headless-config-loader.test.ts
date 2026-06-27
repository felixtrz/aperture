import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadApertureHeadlessApp } from "@aperture-engine/cli";
import { ApertureCliError } from "@aperture-engine/cli";

function fixture(relativePath: string): string {
  return fileURLToPath(new URL(`../fixtures/${relativePath}`, import.meta.url));
}

describe("loadApertureHeadlessApp (P1.2)", () => {
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

  it("rejects a missing config path", async () => {
    await expect(
      loadApertureHeadlessApp({
        configFile: fixture("headless-procedural/does-not-exist.config.ts"),
      }),
    ).rejects.toMatchObject({ code: "aperture.headless.configNotFound" });
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

  it("throws ApertureCliError instances (not bare errors)", async () => {
    await expect(
      loadApertureHeadlessApp({
        configFile: fixture("headless-procedural/missing.config.ts"),
      }),
    ).rejects.toBeInstanceOf(ApertureCliError);
  });
});
