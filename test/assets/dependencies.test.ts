import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

describe("asset dependency diagnostics and manifests", () => {
  it("reports ready dependency chains without diagnostics", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");
    const material = createMaterialHandle("mat");
    const texture = createTextureHandle("albedo");

    registry.register(mesh, { dependencies: [material] });
    registry.register(material, { dependencies: [texture] });
    registry.register(texture);
    registry.markReady(mesh, {});
    registry.markReady(material, {});
    registry.markReady(texture, {});

    expect(registry.inspectDependencies(mesh)).toEqual({
      handleKey: "mesh:cube",
      diagnostics: [],
    });
  });

  it("reports missing, loading, failed, and circular dependencies", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");
    const material = createMaterialHandle("mat");
    const loading = createTextureHandle("loading");
    const failed = createTextureHandle("failed");
    const missing = createTextureHandle("missing");

    registry.register(mesh, { dependencies: [material, missing] });
    registry.register(material, { dependencies: [loading, failed, mesh] });
    registry.register(loading);
    registry.register(failed);
    registry.markLoading(loading);
    registry.markFailed(failed, [
      { code: "texture.failed", message: "decode failed", severity: "error" },
    ]);

    expect(
      registry
        .inspectDependencies(mesh)
        .diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "asset.dependencyLoading",
      "asset.dependencyFailed",
      "asset.dependencyCycle",
      "asset.dependencyMissing",
    ]);
  });

  it("creates an agent-readable manifest with counts and dependency edges", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");
    const material = createMaterialHandle("mat");

    registry.register(mesh, { dependencies: [material] });
    registry.register(material);
    registry.markReady(mesh, {});
    registry.markLoading(material);

    const manifest = registry.createManifestReport();

    expect(manifest.total).toBe(2);
    expect(manifest.byKind.mesh).toBe(1);
    expect(manifest.byKind.material).toBe(1);
    expect(manifest.byStatus.ready).toBe(1);
    expect(manifest.byStatus.loading).toBe(1);
    expect(manifest.dependencies).toEqual([
      { from: "mesh:cube", to: "material:mat" },
    ]);
    expect(manifest.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "asset.dependencyLoading",
    ]);
  });
});
