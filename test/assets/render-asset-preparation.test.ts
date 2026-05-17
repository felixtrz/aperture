import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  PreparedRenderAssetStore,
  createMaterialMetadataRenderAssetAdapter,
  createMeshHandle,
  createPreparedMaterialAssetStore,
  createRenderAssetCollections,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureHandle,
  prepareRenderAsset,
  unloadPreparedRenderAsset,
  type RenderAssetAdapter,
} from "@aperture-engine/core";

describe("render asset preparation contract", () => {
  it("prepares, updates, skips unchanged sources, and unloads deterministically", () => {
    interface MockMeshSource {
      readonly label: string;
      readonly revision: number;
    }

    interface MockPreparedMesh {
      readonly label: string;
      readonly revision: number;
      readonly previousRevision: number | null;
    }

    const registry = new AssetRegistry();
    const handle = createMeshHandle("mock");
    const store = new PreparedRenderAssetStore<"mesh", MockPreparedMesh>();
    const unloaded: string[] = [];
    const adapter: RenderAssetAdapter<
      "mesh",
      MockMeshSource,
      MockPreparedMesh
    > = {
      kind: "mesh",
      family: "mock.mesh",
      prepare(input) {
        return {
          status: "prepared",
          prepared: {
            label: input.source.label,
            revision: input.source.revision,
            previousRevision: input.previous?.prepared.revision ?? null,
          },
        };
      },
      unload(input) {
        unloaded.push(input.assetKey);
      },
    };

    registry.register(handle);
    registry.markReady(handle, { label: "Mock", revision: 1 });

    const created = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });
    const unchanged = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });

    registry.markReady(handle, { label: "Mock", revision: 2 });

    const updated = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });
    const unloadedReport = unloadPreparedRenderAsset({
      adapter,
      store,
      handle,
    });

    expect(created).toMatchObject({
      outcome: "prepared",
      action: "created",
      assetKey: "mesh:mock",
    });
    expect(created.entry?.prepared).toEqual({
      label: "Mock",
      revision: 1,
      previousRevision: null,
    });
    expect(unchanged).toMatchObject({
      outcome: "unchanged",
      assetKey: "mesh:mock",
    });
    expect(updated).toMatchObject({
      outcome: "prepared",
      action: "updated",
      assetKey: "mesh:mock",
    });
    expect(updated.entry?.prepared).toEqual({
      label: "Mock",
      revision: 2,
      previousRevision: 1,
    });
    expect(unloadedReport).toMatchObject({
      removed: true,
      assetKey: "mesh:mock",
    });
    expect(unloaded).toEqual(["mesh:mock"]);
    expect(store.size).toBe(0);
  });

  it("removes prepared metadata when source assets are no longer ready", () => {
    const registry = new AssetRegistry();
    const handle = createMeshHandle("transient");
    const store = new PreparedRenderAssetStore<
      "mesh",
      { readonly revision: number }
    >();
    const adapter: RenderAssetAdapter<
      "mesh",
      { readonly revision: number },
      { readonly revision: number }
    > = {
      kind: "mesh",
      family: "mock.mesh",
      prepare(input) {
        return {
          status: "prepared",
          prepared: { revision: input.source.revision },
        };
      },
    };

    registry.register(handle);
    registry.markReady(handle, { revision: 1 });
    prepareRenderAsset({ registry, adapter, store, handle });

    registry.markLoading(handle);

    const skipped = prepareRenderAsset({ registry, adapter, store, handle });

    expect(skipped).toMatchObject({
      outcome: "skipped",
      assetKey: "mesh:transient",
    });
    expect(skipped.diagnostics[0]?.code).toBe("renderAsset.source.loading");
    expect(store.has(handle)).toBe(false);
  });

  it("retries material preparation until dependencies are ready", () => {
    const assets = createRenderAssetCollections();
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    assets.registry.register(texture);
    assets.registry.register(sampler);
    assets.registry.markLoading(texture);
    assets.registry.markReady(sampler, {});

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Proof Standard",
        baseColorTexture: { texture, sampler },
        metallicFactor: 0.25,
        roughnessFactor: 0.6,
      }),
    );
    const store = createPreparedMaterialAssetStore();
    const adapter = createMaterialMetadataRenderAssetAdapter();

    const retry = prepareRenderAsset({
      registry: assets.registry,
      adapter,
      store,
      handle: material,
    });

    assets.registry.markReady(texture, {});

    const prepared = prepareRenderAsset({
      registry: assets.registry,
      adapter,
      store,
      handle: material,
    });

    expect(retry).toMatchObject({
      outcome: "retry",
      assetKey: "material:standard-material-1",
    });
    expect(retry.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.asset.dependencyLoading",
    ]);
    expect(store.size).toBe(1);
    expect(prepared).toMatchObject({
      outcome: "prepared",
      action: "created",
      assetKey: "material:standard-material-1",
    });
    expect(prepared.entry?.prepared).toMatchObject({
      resourceFamily: "material",
      sourceMaterialKey: "material:standard-material-1",
      label: "Proof Standard",
      materialFamily: "standard",
      materialKind: "standard",
      dependencies: ["texture:albedo", "sampler:linear"],
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      pipelineKeyInput: {
        shaderFamily: "standard",
        features: ["baseColorTexture"],
      },
      materialResourceKey: "prepared-material:material:standard-material-1",
      bindGroupResourceKey:
        "prepared-material-bind-group:material:standard-material-1|pipeline:standard|baseColorTexture|opaque|back|less|none",
    });
  });
});
