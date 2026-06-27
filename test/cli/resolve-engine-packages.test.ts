import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  renderHarnessHtml,
  resolveEnginePackages,
} from "@aperture-engine/cli";

// PB.1: the harness import map must resolve every engine/vendor package from
// the CLI's own location, under whatever install layout we run in.
describe("resolveEnginePackages (PB.1)", () => {
  const resolved = resolveEnginePackages();

  it("resolves every package the harness graph needs", () => {
    const required = [
      "@aperture-engine/render",
      "@aperture-engine/webgpu",
      "@aperture-engine/simulation",
      "@aperture-engine/runtime",
      "@aperture-engine/physics",
      "@aperture-engine/math",
      "@aperture-engine/app/asset-mirror",
      "elics",
      "wgpu-matrix",
    ];
    for (const specifier of required) {
      expect(resolved.importMap[specifier], specifier).toBeDefined();
    }
  });

  it("points every import-map target at an existing on-disk file", () => {
    for (const [specifier, url] of Object.entries(resolved.importMap)) {
      const mount = resolved.mounts.find((entry) => url.startsWith(entry.prefix));
      expect(mount, specifier).toBeDefined();
      const file = path.join(
        mount!.dir,
        url.slice(mount!.prefix.length).split("/").join(path.sep),
      );
      expect(existsSync(file), `${specifier} -> ${file}`).toBe(true);
    }
  });

  it("bakes the resolved import map into the harness html", () => {
    const html = renderHarnessHtml(resolved.importMap);
    expect(html).toContain('<script type="importmap">');
    expect(html).toContain("@aperture-engine/webgpu");
    expect(html).toContain('id="aperture-canvas"');
    expect(html).toContain("/_harness/render-harness.main.js");
  });
});
