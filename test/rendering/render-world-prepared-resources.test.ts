import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  assetHandleKey,
  createBatchCompatibilityKey,
  createBoxMeshAsset,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createPreparedMaterialStore,
  createPreparedMeshStore,
  createRenderAssetCollections,
  createRenderSortKey,
  createStableRenderId,
  createStandardMaterialAsset,
  prepareAndBindSnapshotPreparedResourcesToRenderWorld,
  type MaterialHandle,
  type MeshDrawPacket,
  type MeshHandle,
  type RenderSnapshot,
} from "@aperture-engine/core";

describe("render world prepared resource bindings", () => {
  it("prepares and binds mesh and material resource keys after one snapshot apply", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Combined Prepared Cube" }),
    );
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Combined Prepared Standard" }),
    );
    const meshes = createPreparedMeshStore();
    const materials = createPreparedMaterialStore();
    const world = new RenderWorld();
    const sourceSnapshot = snapshot([packet({ renderId: 1, mesh, material })]);

    const report = prepareAndBindSnapshotPreparedResourcesToRenderWorld({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      renderWorld: world,
      meshes,
      materials,
    });
    const readiness = world.createDrawReadinessReport();

    expect(report).toMatchObject({
      apply: { created: 1, updated: 0, removed: 0, active: 1 },
      meshes: {
        preparation: { totalMeshes: 1, prepared: 1, diagnostics: [] },
        binding: { updated: 1, missing: 0, diagnostics: [] },
      },
      materials: {
        preparation: { totalMaterials: 1, prepared: 1, diagnostics: [] },
        binding: { updated: 1, missing: 0, diagnostics: [] },
      },
      diagnostics: [],
    });
    expect(readiness.ready[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: `prepared-mesh:${assetHandleKey(mesh)}`,
      materialResourceKey: `prepared-material:${assetHandleKey(material)}`,
    });
    expect("meshResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect("materialResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect(JSON.stringify(world.listObjects())).not.toContain("Float32Array");
    expect(JSON.stringify(world.listObjects())).not.toContain("GPU");
  });

  it("keeps missing mesh and material diagnostics distinct", () => {
    const assets = createRenderAssetCollections();
    const mesh = createMeshHandle("missing-combined-cube");
    const material = createMaterialHandle("missing-combined-standard");
    const meshes = createPreparedMeshStore();
    const materials = createPreparedMaterialStore();
    const world = new RenderWorld();
    const sourceSnapshot = snapshot([packet({ renderId: 2, mesh, material })]);

    world.applySnapshot(sourceSnapshot);
    world.updateResourceBindings(2, {
      meshResourceKey: "prepared-mesh:mesh:stale",
      materialResourceKey: "prepared-material:material:stale",
    });

    const report = prepareAndBindSnapshotPreparedResourcesToRenderWorld({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      renderWorld: world,
      meshes,
      materials,
    });
    const readiness = world.createDrawReadinessReport();

    expect(report.apply).toMatchObject({
      created: 0,
      updated: 1,
      removed: 0,
      active: 1,
    });
    expect(report.meshes.preparation).toMatchObject({
      totalMeshes: 1,
      skipped: 1,
    });
    expect(report.materials.preparation).toMatchObject({
      totalMaterials: 1,
      skipped: 1,
    });
    expect(report.meshes.binding).toMatchObject({ updated: 0, missing: 1 });
    expect(report.materials.binding).toMatchObject({
      updated: 0,
      missing: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.sourceMissing",
      "renderAsset.sourceMissing",
      "renderWorld.missingPreparedMeshResource",
      "renderWorld.missingPreparedMaterialResource",
    ]);
    expect(world.getObject(2)?.gpu).toEqual({
      meshResourceKey: null,
      materialResourceKey: null,
    });
    expect(readiness.blocked[0]).toMatchObject({
      renderId: 2,
      missing: ["missing-mesh-resource", "missing-material-resource"],
    });
    expect("meshResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect("materialResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect(JSON.stringify(report)).not.toContain("GPU");
  });
});

function packet(input: {
  readonly renderId: number;
  readonly mesh: MeshHandle;
  readonly material: MaterialHandle;
}): MeshDrawPacket {
  const entity = { index: input.renderId, generation: 0 };
  const materialAsset = createStandardMaterialAsset();
  const materialPipeline = createMaterialPipelineKeyInput(materialAsset);

  return {
    renderId: createStableRenderId(entity),
    entity,
    mesh: input.mesh,
    material: input.material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: createRenderSortKey({
      stableId: createStableRenderId(entity),
      pipelineKey: "standard|opaque|back|less|none",
      materialKey: input.material.id,
      meshKey: input.mesh.id,
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
