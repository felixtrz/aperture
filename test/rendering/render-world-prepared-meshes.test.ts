import { describe, expect, it } from "vitest";
import {
  RenderWorld,
  bindPreparedMeshResourcesToRenderWorld,
  createBatchCompatibilityKey,
  createBoxMeshAsset,
  createMaterialPipelineKeyInput,
  createPreparedMeshStore,
  createRenderAssetCollections,
  createRenderSortKey,
  createStableRenderId,
  createStandardMaterialAsset,
  prepareAndBindSnapshotMeshesToRenderWorld,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";

describe("render world prepared mesh bindings", () => {
  it("prepares snapshot meshes and binds render-world mesh keys", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Combined Prepared Mesh" }),
    );
    const material = createMaterialHandle("combined-material");
    const meshes = createPreparedMeshStore();
    const world = new RenderWorld();
    const sourceSnapshot = snapshot([packet({ renderId: 1, mesh, material })]);

    const report = prepareAndBindSnapshotMeshesToRenderWorld({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      renderWorld: world,
      meshes,
    });
    const meshOnlyBlocked = world.createDrawReadinessReport();

    world.updateResourceBindings(1, {
      materialResourceKey: "prepared-material:material:combined-material",
    });

    const ready = world.createDrawReadinessReport();

    expect(report).toMatchObject({
      apply: { created: 1, updated: 0, removed: 0, active: 1 },
      preparation: {
        totalMeshes: 1,
        prepared: 1,
        diagnostics: [],
      },
      binding: { updated: 1, missing: 0, diagnostics: [] },
      diagnostics: [],
    });
    expect(meshOnlyBlocked.blocked[0]).toMatchObject({
      renderId: 1,
      missing: ["missing-material-resource"],
    });
    expect(ready.ready[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: "prepared-mesh:mesh:mesh-1",
      materialResourceKey: "prepared-material:material:combined-material",
    });
    expect("meshResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
    expect(JSON.stringify(world.listObjects())).not.toContain("Float32Array");
    expect(JSON.stringify(world.listObjects())).not.toContain("GPU");
  });

  it("keeps combined helper draws blocked when source meshes are missing", () => {
    const assets = createRenderAssetCollections();
    const mesh = createMeshHandle("missing-source-cube");
    const material = createMaterialHandle("missing-source-material");
    const meshes = createPreparedMeshStore();
    const world = new RenderWorld();

    const report = prepareAndBindSnapshotMeshesToRenderWorld({
      registry: assets.registry,
      snapshot: snapshot([packet({ renderId: 2, mesh, material })]),
      renderWorld: world,
      meshes,
    });

    world.updateResourceBindings(2, {
      materialResourceKey: "prepared-material:material:missing-source-material",
    });

    const readiness = world.createDrawReadinessReport();

    expect(report.preparation).toMatchObject({
      totalMeshes: 1,
      skipped: 1,
    });
    expect(report.binding).toMatchObject({
      updated: 0,
      missing: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.sourceMissing",
      "renderWorld.missingPreparedMeshResource",
    ]);
    expect(readiness.blocked[0]).toMatchObject({
      renderId: 2,
      missing: ["missing-mesh-resource"],
    });
    expect(JSON.stringify(report)).not.toContain("GPU");
  });

  it("diagnoses missing prepared mesh entries and preserves material bindings", () => {
    const mesh = createMeshHandle("fallback-cube");
    const material = createMaterialHandle("ready-material");
    const meshes = createPreparedMeshStore();
    const world = new RenderWorld();

    world.applySnapshot(snapshot([packet({ renderId: 3, mesh, material })]));
    world.updateResourceBindings(3, {
      meshResourceKey: "prepared-mesh:mesh:stale",
      materialResourceKey: "prepared-material:material:ready-material",
    });

    const report = bindPreparedMeshResourcesToRenderWorld({
      renderWorld: world,
      meshes,
    });
    const readiness = world.createDrawReadinessReport();

    expect(report).toMatchObject({
      updated: 0,
      missing: 1,
      diagnostics: [
        {
          code: "renderWorld.missingPreparedMeshResource",
          severity: "warning",
          assetKey: "mesh:fallback-cube",
        },
      ],
    });
    expect(world.getObject(3)?.gpu).toEqual({
      meshResourceKey: null,
      materialResourceKey: "prepared-material:material:ready-material",
    });
    expect(readiness.blocked[0]).toMatchObject({
      renderId: 3,
      missing: ["missing-mesh-resource"],
    });
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
