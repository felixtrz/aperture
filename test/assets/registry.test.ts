import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  assetHandleKey,
  assetHandlesEqual,
  createAnimationClipHandle,
  createEnvironmentMapHandle,
  createFontAtlasHandle,
  createMaterialHandle,
  createMeshHandle,
  createMorphTargetSetHandle,
  createPrefabHandle,
  createRenderTargetHandle,
  createSamplerHandle,
  createSceneHandle,
  createSkinHandle,
  createTextureHandle,
  deserializeAssetHandle,
  serializeAssetHandle,
  type AssetDiagnostic,
} from "@aperture-engine/simulation";

describe("asset handles and registry", () => {
  it("creates branded handles for every MVP asset kind", () => {
    expect(createMeshHandle("mesh").kind).toBe("mesh");
    expect(createMaterialHandle("material").kind).toBe("material");
    expect(createTextureHandle("texture").kind).toBe("texture");
    expect(createSamplerHandle("sampler").kind).toBe("sampler");
    expect(createRenderTargetHandle("target").kind).toBe("render-target");
    expect(createSceneHandle("scene").kind).toBe("scene");
    expect(createPrefabHandle("prefab").kind).toBe("prefab");
    expect(createAnimationClipHandle("clip").kind).toBe("animation-clip");
    expect(createSkinHandle("skin").kind).toBe("skin");
    expect(createMorphTargetSetHandle("morphs").kind).toBe("morph-target-set");
    expect(createEnvironmentMapHandle("environment").kind).toBe(
      "environment-map",
    );
    expect(createFontAtlasHandle("font").kind).toBe("font-atlas");
  });

  it("compares and serializes handles without carrying asset objects", () => {
    const first = createMeshHandle("cube");
    const second = createMeshHandle("cube");
    const material = createMaterialHandle("cube");
    const serialized = serializeAssetHandle(first);

    expect(assetHandlesEqual(first, second)).toBe(true);
    expect(assetHandlesEqual(first, material)).toBe(false);
    expect(assetHandleKey(first)).toBe("mesh:cube");
    expect(serialized).toEqual({ kind: "mesh", id: "cube" });
    expect(Object.keys(serialized)).toEqual(["kind", "id"]);
    expect(assetHandlesEqual(deserializeAssetHandle(serialized), first)).toBe(
      true,
    );
  });

  it("registers assets and exposes status, labels, dependencies, diagnostics, and versions", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");
    const material = createMaterialHandle("debug");
    const diagnostic: AssetDiagnostic = {
      code: "asset.note",
      message: "registered from test",
      severity: "info",
    };

    const registered = registry.register(mesh, {
      label: "Cube Mesh",
      dependencies: [material],
      diagnostics: [diagnostic],
    });

    expect(registered).toMatchObject({
      handle: mesh,
      kind: "mesh",
      label: "Cube Mesh",
      status: "registered",
      version: 0,
      asset: null,
    });
    expect(registered.dependencies).toEqual([material]);
    expect(registered.diagnostics).toEqual([diagnostic]);
    expect(registry.getStatus(mesh)).toBe("registered");

    const loading = registry.markLoading(mesh);

    expect(loading.status).toBe("loading");
    expect(loading.version).toBe(1);

    const ready = registry.markReady(mesh, { vertexCount: 36 });

    expect(ready.status).toBe("ready");
    expect(ready.version).toBe(2);
    expect(ready.asset).toEqual({ vertexCount: 36 });
    expect(registry.list({ status: "ready" })).toEqual([ready]);
  });

  it("records ready-asset provenance and clears it on non-ready transitions", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("albedo");

    registry.register(texture);

    const placeholder = registry.markReady(
      texture,
      { width: 1, height: 1 },
      [],
      "placeholder",
    );

    expect(placeholder.provenance).toBe("placeholder");
    expect(registry.createManifestReport().placeholders).toEqual({
      count: 1,
      ids: ["albedo"],
    });

    const loading = registry.markLoading(texture);
    expect(loading.provenance).toBeUndefined();
    expect(registry.createManifestReport().placeholders).toEqual({
      count: 0,
      ids: [],
    });

    const loaded = registry.markReady(texture, { width: 2, height: 2 });
    expect(loaded.provenance).toBe("loaded");
  });

  it("records failed assets and returns undefined for missing handles", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("missing-albedo");
    const missing = createTextureHandle("not-registered");
    const diagnostic: AssetDiagnostic = {
      code: "asset.loadFailed",
      message: "source image could not be decoded",
      severity: "error",
    };

    registry.register(texture);

    const failed = registry.markFailed(texture, [diagnostic]);

    expect(failed.status).toBe("failed");
    expect(failed.version).toBe(1);
    expect(failed.asset).toBeNull();
    expect(registry.collectDiagnostics(texture)).toEqual([diagnostic]);
    expect(registry.get(missing)).toBeUndefined();
    expect(registry.getStatus(missing)).toBeUndefined();
  });

  it("unregisters assets and returns the removed entry", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("temporary");

    registry.register(mesh, { label: "Temporary Mesh" });
    registry.markReady(mesh, { vertexCount: 24 });

    const removed = registry.unregister(mesh);

    expect(removed).toMatchObject({
      handle: mesh,
      kind: "mesh",
      label: "Temporary Mesh",
      status: "ready",
      version: 1,
      asset: { vertexCount: 24 },
    });
    expect(registry.has(mesh)).toBe(false);
    expect(registry.get(mesh)).toBeUndefined();
    expect(registry.getStatus(mesh)).toBeUndefined();
    expect(registry.unregister(mesh)).toBeUndefined();
  });

  it("keeps handles with the same id but different kinds separate", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("shared-id");
    const material = createMaterialHandle("shared-id");

    registry.register(mesh);
    registry.register(material);
    registry.markReady(mesh, { mesh: true });
    registry.markFailed(material, [
      {
        code: "material.invalid",
        message: "material schema failed validation",
        severity: "error",
      },
    ]);

    expect(registry.getStatus(mesh)).toBe("ready");
    expect(registry.getStatus(material)).toBe("failed");
    expect(registry.list({ kind: "mesh" })).toHaveLength(1);
    expect(registry.list({ kind: "material" })).toHaveLength(1);
  });
});
