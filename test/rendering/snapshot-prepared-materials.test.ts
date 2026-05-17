import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createBatchCompatibilityKey,
  createBoxMeshAsset,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createPreparedMeshStore,
  createPreparedMaterialStore,
  createRenderAssetCollections,
  createRenderSortKey,
  createStableRenderId,
  createUnlitMaterialAsset,
  prepareSnapshotMeshes,
  prepareSnapshotMaterials,
  type MaterialHandle,
  type MeshHandle,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";

describe("snapshot prepared material facade preparation", () => {
  it("prepares each unique snapshot material once and leaves snapshots immutable", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Snapshot Prepared Unlit" }),
    );
    const materials = createPreparedMaterialStore();
    const sourceSnapshot = snapshot([
      packet({ renderId: 1, material }),
      packet({ renderId: 2, material }),
    ]);

    const first = prepareSnapshotMaterials({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      materials,
    });
    const second = prepareSnapshotMaterials({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      materials,
    });

    expect(first).toMatchObject({
      totalMaterials: 1,
      prepared: 1,
      unchanged: 0,
      retry: 0,
      failed: 0,
      skipped: 0,
      pruned: 0,
      diagnostics: [],
    });
    expect(first.entries).toEqual([
      {
        materialKey: "material:unlit-material-1",
        outcome: "prepared",
        action: "created",
        diagnostics: [],
      },
    ]);
    expect(second).toMatchObject({
      totalMaterials: 1,
      prepared: 0,
      unchanged: 1,
      retry: 0,
      failed: 0,
      skipped: 0,
      pruned: 0,
      diagnostics: [],
    });
    expect(materials.list()).toHaveLength(1);
    expect("materialResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect(JSON.stringify(first)).not.toContain("GPU");
  });

  it("reports missing and loading source materials without preparing entries", () => {
    const registry = new AssetRegistry();
    const missing = createMaterialHandle("missing");
    const loading = createMaterialHandle("loading");
    const materials = createPreparedMaterialStore();

    registry.register(loading);
    registry.markLoading(loading);

    const report = prepareSnapshotMaterials({
      registry,
      snapshot: snapshot([
        packet({ renderId: 3, material: missing }),
        packet({ renderId: 4, material: loading }),
      ]),
      materials,
    });

    expect(report).toMatchObject({
      totalMaterials: 2,
      prepared: 0,
      unchanged: 0,
      retry: 0,
      failed: 0,
      skipped: 2,
      pruned: 0,
    });
    expect(report.entries.map((entry) => entry.materialKey)).toEqual([
      "material:missing",
      "material:loading",
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.sourceMissing",
      "renderAsset.source.loading",
    ]);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetKey: "material:missing",
          materialKey: "material:missing",
          status: "skipped",
        }),
        expect.objectContaining({
          assetKey: "material:loading",
          materialKey: "material:loading",
          status: "skipped",
        }),
      ]),
    );
    expect(materials.list()).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("Map");
  });

  it("can prune prepared material entries no longer referenced by a snapshot", () => {
    const assets = createRenderAssetCollections();
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Retained Snapshot Material" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Pruned Snapshot Material" }),
    );
    const materials = createPreparedMaterialStore();

    const initial = prepareSnapshotMaterials({
      registry: assets.registry,
      snapshot: snapshot([
        packet({ renderId: 5, material: firstMaterial }),
        packet({ renderId: 6, material: secondMaterial }),
      ]),
      materials,
    });
    const pruned = prepareSnapshotMaterials({
      registry: assets.registry,
      snapshot: snapshot([packet({ renderId: 7, material: firstMaterial })]),
      materials,
      pruneUnreferenced: true,
    });

    expect(initial).toMatchObject({
      totalMaterials: 2,
      prepared: 2,
      pruned: 0,
      diagnostics: [],
    });
    expect(pruned).toMatchObject({
      totalMaterials: 1,
      prepared: 0,
      unchanged: 1,
      pruned: 1,
      diagnostics: [],
    });
    expect(materials.list().map((entry) => entry.assetKey)).toEqual([
      "material:unlit-material-1",
    ]);
  });
});

describe("snapshot prepared mesh facade preparation", () => {
  it("prepares each unique snapshot mesh once and leaves snapshots immutable", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Snapshot Prepared Mesh" }),
    );
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());
    const meshes = createPreparedMeshStore();
    const sourceSnapshot = snapshot([
      packet({ renderId: 8, mesh, material }),
      packet({ renderId: 9, mesh, material }),
    ]);

    const first = prepareSnapshotMeshes({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      meshes,
    });
    const second = prepareSnapshotMeshes({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      meshes,
    });

    expect(first).toMatchObject({
      totalMeshes: 1,
      prepared: 1,
      unchanged: 0,
      retry: 0,
      failed: 0,
      skipped: 0,
      pruned: 0,
      diagnostics: [],
    });
    expect(first.entries).toEqual([
      {
        meshKey: "mesh:mesh-1",
        outcome: "prepared",
        action: "created",
        diagnostics: [],
      },
    ]);
    expect(second).toMatchObject({
      totalMeshes: 1,
      prepared: 0,
      unchanged: 1,
      retry: 0,
      failed: 0,
      skipped: 0,
      pruned: 0,
      diagnostics: [],
    });
    expect(meshes.list()[0]?.prepared.meshResourceKey).toBe(
      "prepared-mesh:mesh:mesh-1",
    );
    expect("meshResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect(JSON.stringify(first)).not.toContain("Float32Array");
    expect(JSON.stringify(first)).not.toContain("GPU");
  });

  it("can prune prepared mesh entries no longer referenced by a snapshot", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());
    const firstMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Retained Snapshot Mesh" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Pruned Snapshot Mesh" }),
    );
    const meshes = createPreparedMeshStore();

    const initial = prepareSnapshotMeshes({
      registry: assets.registry,
      snapshot: snapshot([
        packet({ renderId: 10, mesh: firstMesh, material }),
        packet({ renderId: 11, mesh: secondMesh, material }),
      ]),
      meshes,
    });
    const pruned = prepareSnapshotMeshes({
      registry: assets.registry,
      snapshot: snapshot([packet({ renderId: 12, mesh: firstMesh, material })]),
      meshes,
      pruneUnreferenced: true,
    });

    expect(initial).toMatchObject({
      totalMeshes: 2,
      prepared: 2,
      pruned: 0,
      diagnostics: [],
    });
    expect(pruned).toMatchObject({
      totalMeshes: 1,
      prepared: 0,
      unchanged: 1,
      pruned: 1,
      diagnostics: [],
    });
    expect(meshes.list().map((entry) => entry.assetKey)).toEqual([
      "mesh:mesh-1",
    ]);
  });
});

function packet(input: {
  readonly renderId: number;
  readonly material: MaterialHandle;
  readonly mesh?: MeshHandle;
}): MeshDrawPacket {
  const entity = { index: input.renderId, generation: 0 };
  const stableId = createStableRenderId(entity);
  const mesh = input.mesh ?? createMeshHandle(`mesh-${input.renderId}`);
  const materialAsset = createUnlitMaterialAsset();
  const materialPipeline = createMaterialPipelineKeyInput(materialAsset);

  return {
    renderId: stableId,
    entity,
    mesh,
    material: input.material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: createRenderSortKey({
      stableId,
      pipelineKey: "unlit|opaque|back|less|none",
      materialKey: input.material.id,
      meshKey: mesh.id,
    }),
    batchKey: createBatchCompatibilityKey({
      materialPipeline,
      materialKey: input.material.id,
      meshLayoutKey: "mesh-layout:position-normal-uv",
      topology: "triangle-list",
    }),
  };
}

function snapshot(meshDraws: readonly MeshDrawPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: meshDraws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
