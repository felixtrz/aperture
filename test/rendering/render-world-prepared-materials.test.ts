import { describe, expect, it } from "vitest";
import {
  RenderWorld,
  bindPreparedMaterialResourcesToRenderWorld,
  createBatchCompatibilityKey,
  createMaterialPipelineKeyInput,
  createRenderAssetCollections,
  createRenderSortKey,
  createStableRenderId,
  createStandardMaterialAsset,
  createPreparedMaterialStore,
  prepareAndBindSnapshotMaterialsToRenderWorld,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";

describe("render world prepared material bindings", () => {
  it("prepares snapshot materials and binds render-world material keys", () => {
    const assets = createRenderAssetCollections();
    const mesh = createMeshHandle("combined-cube");
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Combined Prepared Standard" }),
    );
    const materials = createPreparedMaterialStore();
    const world = new RenderWorld();
    const sourceSnapshot = snapshot([packet({ renderId: 1, mesh, material })]);

    const report = prepareAndBindSnapshotMaterialsToRenderWorld({
      registry: assets.registry,
      snapshot: sourceSnapshot,
      renderWorld: world,
      materials,
    });
    const materialOnlyBlocked = world.createDrawReadinessReport();

    world.updateResourceBindings(1, {
      meshResourceKey: "prepared-mesh:mesh:combined-cube",
    });

    const ready = world.createDrawReadinessReport();

    expect(report).toMatchObject({
      apply: { created: 1, updated: 0, removed: 0, active: 1 },
      preparation: {
        totalMaterials: 1,
        prepared: 1,
        diagnostics: [],
      },
      binding: { updated: 1, missing: 0, diagnostics: [] },
      diagnostics: [],
    });
    expect(materialOnlyBlocked.blocked[0]).toMatchObject({
      renderId: 1,
      missing: ["missing-mesh-resource"],
    });
    expect(ready.ready[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: "prepared-mesh:mesh:combined-cube",
      materialResourceKey: "prepared-material:material:standard-material-1@v1",
    });
    expect("materialResourceKey" in sourceSnapshot.meshDraws[0]!).toBe(false);
  });

  it("keeps combined helper draws blocked when source materials are missing", () => {
    const assets = createRenderAssetCollections();
    const mesh = createMeshHandle("missing-source-cube");
    const material = createMaterialHandle("missing-source");
    const materials = createPreparedMaterialStore();
    const world = new RenderWorld();

    const report = prepareAndBindSnapshotMaterialsToRenderWorld({
      registry: assets.registry,
      snapshot: snapshot([packet({ renderId: 2, mesh, material })]),
      renderWorld: world,
      materials,
    });

    world.updateResourceBindings(2, {
      meshResourceKey: "prepared-mesh:mesh:missing-source-cube",
    });

    const readiness = world.createDrawReadinessReport();

    expect(report.preparation).toMatchObject({
      totalMaterials: 1,
      skipped: 1,
    });
    expect(report.binding).toMatchObject({
      updated: 0,
      missing: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.sourceMissing",
      "renderWorld.missingPreparedMaterialResource",
    ]);
    expect(readiness.blocked[0]).toMatchObject({
      renderId: 2,
      missing: ["missing-material-resource"],
    });
    expect(JSON.stringify(report)).not.toContain("GPU");
  });

  it("binds prepared material resource keys without mutating snapshots", () => {
    const assets = createRenderAssetCollections();
    const mesh = createMeshHandle("cube");
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Prepared Standard" }),
    );
    const materials = createPreparedMaterialStore();
    const prepared = materials.prepare({
      registry: assets.registry,
      handle: material,
    });
    const world = new RenderWorld();
    const sourceSnapshot = snapshot([packet({ renderId: 1, mesh, material })]);

    world.applySnapshot(sourceSnapshot);

    const initiallyBlocked = world.createDrawReadinessReport();
    const bindReport = bindPreparedMaterialResourcesToRenderWorld({
      renderWorld: world,
      materials,
    });
    const materialOnlyBlocked = world.createDrawReadinessReport();

    world.updateResourceBindings(1, {
      meshResourceKey: "prepared-mesh:mesh:cube",
    });

    const ready = world.createDrawReadinessReport();

    expect(prepared.entry?.prepared.materialResourceKey).toBe(
      "prepared-material:material:standard-material-1@v1",
    );
    expect(initiallyBlocked.blocked[0]?.missing).toEqual([
      "missing-mesh-resource",
      "missing-material-resource",
    ]);
    expect(bindReport).toEqual({
      updated: 1,
      missing: 0,
      diagnostics: [],
    });
    expect(materialOnlyBlocked.blocked[0]).toMatchObject({
      renderId: 1,
      missing: ["missing-mesh-resource"],
    });
    expect(ready.ready[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: "prepared-mesh:mesh:cube",
      materialResourceKey: "prepared-material:material:standard-material-1@v1",
    });
    const sourceDraw = sourceSnapshot.meshDraws[0];

    if (sourceDraw === undefined) {
      throw new Error("Expected source snapshot to contain one draw packet.");
    }

    expect("materialResourceKey" in sourceDraw).toBe(false);
    expect(JSON.stringify(world.listObjects())).not.toContain(
      "prepared-material-bind-group",
    );
  });

  it("diagnoses missing prepared material entries and preserves mesh bindings", () => {
    const mesh = createMeshHandle("fallback-cube");
    const material = createMaterialHandle("missing");
    const materials = createPreparedMaterialStore();
    const world = new RenderWorld();

    world.applySnapshot(snapshot([packet({ renderId: 2, mesh, material })]));
    world.updateResourceBindings(2, {
      meshResourceKey: "prepared-mesh:mesh:fallback-cube",
      materialResourceKey: "prepared-material:material:stale@v1",
    });

    const report = bindPreparedMaterialResourcesToRenderWorld({
      renderWorld: world,
      materials,
    });
    const readiness = world.createDrawReadinessReport();

    expect(report).toMatchObject({
      updated: 0,
      missing: 1,
      diagnostics: [
        {
          code: "renderWorld.missingPreparedMaterialResource",
          severity: "warning",
          assetKey: "material:missing",
        },
      ],
    });
    expect(world.getObject(2)?.gpu).toEqual({
      meshResourceKey: "prepared-mesh:mesh:fallback-cube",
      materialResourceKey: null,
    });
    expect(readiness.blocked[0]).toMatchObject({
      renderId: 2,
      missing: ["missing-material-resource"],
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
