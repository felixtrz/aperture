import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  assetHandleKey,
  createBoxMeshAsset,
  createMatcapMaterialAsset,
  createMeshHandle,
  createRenderAssetCollections,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureHandle,
  createTypedAssetCollection,
  createUnlitMaterialAsset,
  type AssetDiagnostic,
} from "@aperture-engine/core";

describe("typed asset collections", () => {
  it("adds mesh and material assets through typed collections", () => {
    const assets = createRenderAssetCollections();
    const mesh = createBoxMeshAsset({ label: "Cube" });
    const material = createStandardMaterialAsset({
      label: "Brushed Metal",
      metallicFactor: 0.8,
      roughnessFactor: 0.35,
    });

    const meshHandle = assets.meshes.add(mesh);
    const materialHandle = assets.materials.standard.add(material);

    expect(assetHandleKey(meshHandle)).toBe("mesh:mesh-1");
    expect(assetHandleKey(materialHandle)).toBe("material:standard-material-1");
    expect(assets.registry.get(meshHandle)).toMatchObject({
      handle: meshHandle,
      kind: "mesh",
      label: "Cube",
      status: "ready",
      version: 1,
      asset: mesh,
    });
    expect(assets.registry.get(materialHandle)).toMatchObject({
      handle: materialHandle,
      kind: "material",
      label: "Brushed Metal",
      status: "ready",
      version: 1,
      asset: material,
    });
    expect(assets.meshes.getAsset(meshHandle)).toBe(mesh);
    expect(assets.materials.standard.getAsset(materialHandle)).toBe(material);
  });

  it("keeps explicit ids stable and reports duplicate registrations", () => {
    const assets = createRenderAssetCollections();
    const first = assets.meshes.add(createBoxMeshAsset(), { id: "cube" });

    expect(assetHandleKey(first)).toBe("mesh:cube");
    expect(assets.meshes.get(first)?.handle).toBe(first);
    expect(() =>
      assets.meshes.add(createBoxMeshAsset({ label: "Duplicate" }), {
        id: "cube",
      }),
    ).toThrow("Asset 'mesh:cube' is already registered.");
  });

  it("delegates status transitions and diagnostics to the registry", () => {
    const assets = createRenderAssetCollections();
    const diagnostic: AssetDiagnostic = {
      code: "mesh.decode",
      message: "mesh source is pending decode",
      severity: "warning",
    };
    const handle = assets.meshes.register({
      id: "remote-cube",
      diagnostics: [diagnostic],
    });

    const registered = assets.meshes.get(handle);
    const loading = assets.meshes.markLoading(handle);
    const ready = assets.meshes.markReady(
      handle,
      createBoxMeshAsset({ label: "Remote Cube" }),
    );

    expect(registered).toMatchObject({
      status: "registered",
      version: 0,
      diagnostics: [diagnostic],
    });
    expect(loading).toMatchObject({
      handle,
      status: "loading",
      version: 1,
      diagnostics: [diagnostic],
    });
    expect(ready).toMatchObject({
      handle,
      status: "ready",
      version: 2,
      diagnostics: [],
    });
  });

  it("records material texture dependencies in the underlying registry", () => {
    const assets = createRenderAssetCollections();
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    assets.registry.register(texture);
    assets.registry.register(sampler);
    assets.registry.markLoading(texture);
    assets.registry.markFailed(sampler, [
      {
        code: "sampler.invalid",
        message: "sampler settings failed validation",
        severity: "error",
      },
    ]);

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Textured",
        baseColorTexture: { texture, sampler },
      }),
    );

    expect(assets.registry.get(material)?.dependencies).toEqual([
      texture,
      sampler,
    ]);
    expect(
      assets.registry
        .inspectDependencies(material)
        .diagnostics.map((entry) => entry.code),
    ).toEqual(["asset.dependencyLoading", "asset.dependencyFailed"]);
    expect(assets.registry.createManifestReport().dependencies).toContainEqual({
      from: assetHandleKey(material),
      to: assetHandleKey(texture),
    });
  });

  it("adds matcap material assets and records matcap texture dependencies", () => {
    const assets = createRenderAssetCollections();
    const texture = createTextureHandle("studio-matcap");
    const sampler = createSamplerHandle("linear-clamp");

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Studio Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    expect(assetHandleKey(material)).toBe("material:matcap-material-1");
    expect(assets.registry.get(material)).toMatchObject({
      handle: material,
      kind: "material",
      label: "Studio Matcap",
      status: "ready",
      version: 1,
    });
    expect(assets.registry.get(material)?.dependencies).toEqual([
      texture,
      sampler,
    ]);
  });

  it("supports headless generic typed collections over a shared registry", () => {
    interface HeadlessMesh {
      readonly label: string;
      readonly vertexCount: number;
    }

    const registry = new AssetRegistry();
    const meshes = createTypedAssetCollection<"mesh", HeadlessMesh>({
      registry,
      kind: "mesh",
      createHandle: createMeshHandle,
      idPrefix: "headless-mesh",
      label: (asset) => asset.label,
    });

    const handle = meshes.add({ label: "Headless Mesh", vertexCount: 3 });

    expect(assetHandleKey(handle)).toBe("mesh:headless-mesh-1");
    expect(registry.get(handle)?.asset).toEqual({
      label: "Headless Mesh",
      vertexCount: 3,
    });
  });
});
