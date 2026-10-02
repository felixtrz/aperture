import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeApertureGeneratedActionTypes } from "../../packages/vite-plugin/src/generated-action-types.js";
import { loadApertureVirtualModule } from "../../packages/vite-plugin/src/virtual-modules.js";

vi.mock("../../packages/vite-plugin/src/generated-action-types.js", () => ({
  writeApertureGeneratedActionTypes: vi.fn(async () => "generated-types.d.ts"),
}));

describe("Aperture virtual-module load boundaries", () => {
  const root = path.join(tmpdir(), "aperture-virtual-load-test");
  const configFile = path.join(root, "aperture.config.ts");
  const options = { root, aiDevtoolsEnabled: false };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores unrelated modules without evaluating config or generating types", async () => {
    const ids = [
      "/project/src/main.ts",
      "/project/src/styles.css?direct",
      "react",
      "\0astro:page",
      "virtual:aperture/not-real",
      "\0virtual:aperture/config-extra",
      ...Array.from({ length: 250 }, (_, index) => `/dependency/${index}.js`),
    ];

    await expect(
      Promise.all(ids.map((id) => loadApertureVirtualModule(id, options))),
    ).resolves.toEqual(ids.map(() => null));
    expect(writeApertureGeneratedActionTypes).not.toHaveBeenCalled();
  });

  it.each([
    "virtual:aperture/config",
    "\0virtual:aperture/config",
    "virtual:aperture/config?t=123",
    "\0virtual:aperture/config?t=123",
  ])("still refreshes generated types for %s", async (id) => {
    await expect(loadApertureVirtualModule(id, options)).resolves.toBe(
      `export { default } from ${JSON.stringify(configFile.replace(/\\/g, "/"))};`,
    );
    expect(writeApertureGeneratedActionTypes).toHaveBeenCalledExactlyOnceWith({
      root,
      configFile,
    });
  });
});
