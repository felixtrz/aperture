import { describe, expect, it } from "vitest";
import {
  RenderWorld,
  createBatchCompatibilityKey,
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createMaterialPipelineKeyInput,
  createMatcapMaterialAsset,
  createPreparedMaterialStore,
  createPreparedMeshStore,
  createRenderAssetCollections,
  createRenderSortKey,
  createRenderWorldPreparedResourceSummary,
  createRenderWorldPreparedResourceSummaryFromReport,
  createStableRenderId,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  prepareAndBindSnapshotPreparedResourcesToRenderWorld,
  renderWorldPreparedResourceSummaryToJsonValue,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";

describe("render world prepared resource summary", () => {
  it("summarizes prepared facade entries without backend cache details", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Summary Box" }),
    );
    const materials = [
      assets.materials.unlit.add(
        createUnlitMaterialAsset({ label: "Summary Unlit" }),
      ),
      assets.materials.matcap.add(
        createMatcapMaterialAsset({ label: "Summary Matcap" }),
      ),
      assets.materials.standard.add(
        createStandardMaterialAsset({ label: "Summary Standard" }),
      ),
      assets.materials.debugNormal.add(
        createDebugNormalMaterialAsset({ label: "Summary Debug Normal" }),
      ),
    ];
    const preparedMeshes = createPreparedMeshStore();
    const preparedMaterials = createPreparedMaterialStore();

    preparedMeshes.prepare({ registry: assets.registry, handle: mesh });

    for (const material of materials) {
      preparedMaterials.prepare({
        registry: assets.registry,
        handle: material,
      });
    }

    const summary = createRenderWorldPreparedResourceSummary({
      meshes: preparedMeshes,
      materials: preparedMaterials,
    });
    const json = renderWorldPreparedResourceSummaryToJsonValue(summary);

    expect(json).toEqual({
      preparedMeshes: { totalEntries: 1 },
      preparedMaterials: {
        totalEntries: 3,
        families: {
          unlit: { entries: 1 },
          matcap: { entries: 0 },
          standard: { entries: 1 },
          "debug-normal": { entries: 1 },
        },
      },
      bindings: {
        meshes: { present: false, updated: 0, missing: 0 },
        materials: { present: false, updated: 0, missing: 0 },
      },
      drawReadiness: { present: false, ready: 0, blocked: 0 },
      diagnostics: { total: 0, info: 0, warnings: 0, errors: 0 },
    });
    expect(JSON.stringify(json)).not.toContain('entries":[');
    expect(JSON.stringify(json)).not.toContain("pipelineKey");
    expect(JSON.stringify(json)).not.toContain("GPU");
    expect(JSON.stringify(json)).not.toContain("Map");
  });

  it("aligns binding and readiness counters with prepared render-world state", () => {
    const assets = createRenderAssetCollections();
    const readyMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Ready Box" }),
    );
    const readyMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Ready Standard" }),
    );
    const missingMesh = createMeshHandle("missing-summary-box");
    const missingMaterial = createMaterialHandle("missing-summary-standard");
    const preparedMeshes = createPreparedMeshStore();
    const preparedMaterials = createPreparedMaterialStore();
    const world = new RenderWorld();

    const report = prepareAndBindSnapshotPreparedResourcesToRenderWorld({
      registry: assets.registry,
      snapshot: snapshot([
        packet({ renderId: 1, mesh: readyMesh, material: readyMaterial }),
        packet({ renderId: 2, mesh: missingMesh, material: missingMaterial }),
      ]),
      renderWorld: world,
      meshes: preparedMeshes,
      materials: preparedMaterials,
    });
    const drawReadiness = world.createDrawReadinessReport();

    const summary = createRenderWorldPreparedResourceSummary({
      meshes: preparedMeshes,
      materials: preparedMaterials,
      meshBinding: report.meshes.binding,
      materialBinding: report.materials.binding,
      drawReadiness,
      diagnostics: [
        {
          code: "test.explicitError",
          message: "Explicit summary error.",
          severity: "error",
        },
      ],
    });

    expect(summary).toMatchObject({
      preparedMeshes: { totalEntries: 1 },
      preparedMaterials: {
        totalEntries: 1,
        families: {
          unlit: { entries: 0 },
          matcap: { entries: 0 },
          standard: { entries: 1 },
          "debug-normal": { entries: 0 },
        },
      },
      bindings: {
        meshes: { present: true, updated: 1, missing: 1 },
        materials: { present: true, updated: 1, missing: 1 },
      },
      drawReadiness: { present: true, ready: 1, blocked: 1 },
      diagnostics: { total: 5, info: 0, warnings: 4, errors: 1 },
    });
    expect(drawReadiness.ready[0]).toMatchObject({
      meshResourceKey: `prepared-mesh:${assetHandleKey(readyMesh)}`,
      materialResourceKey: `prepared-material:${assetHandleKey(readyMaterial)}@v1`,
    });
    expect(
      JSON.stringify(renderWorldPreparedResourceSummaryToJsonValue(summary)),
    ).not.toContain("GPU");
  });

  it("adapts prepare-and-bind reports without double-counting diagnostics", () => {
    const assets = createRenderAssetCollections();
    const readyMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Ready Report Box" }),
    );
    const readyMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Ready Report Standard" }),
    );
    const missingMesh = createMeshHandle("missing-report-box");
    const missingMaterial = createMaterialHandle("missing-report-standard");
    const preparedMeshes = createPreparedMeshStore();
    const preparedMaterials = createPreparedMaterialStore();
    const world = new RenderWorld();

    const report = prepareAndBindSnapshotPreparedResourcesToRenderWorld({
      registry: assets.registry,
      snapshot: snapshot([
        packet({ renderId: 1, mesh: readyMesh, material: readyMaterial }),
        packet({ renderId: 2, mesh: missingMesh, material: missingMaterial }),
      ]),
      renderWorld: world,
      meshes: preparedMeshes,
      materials: preparedMaterials,
    });
    const drawReadiness = world.createDrawReadinessReport();
    const summary = createRenderWorldPreparedResourceSummaryFromReport({
      meshes: preparedMeshes,
      materials: preparedMaterials,
      report,
      drawReadiness,
      diagnostics: [
        {
          code: "test.explicitError",
          message: "Explicit summary error.",
          severity: "error",
        },
      ],
    });

    expect(summary).toMatchObject({
      preparedMeshes: { totalEntries: 1 },
      preparedMaterials: {
        totalEntries: 1,
        families: {
          unlit: { entries: 0 },
          matcap: { entries: 0 },
          standard: { entries: 1 },
          "debug-normal": { entries: 0 },
        },
      },
      bindings: {
        meshes: { present: true, updated: 1, missing: 1 },
        materials: { present: true, updated: 1, missing: 1 },
      },
      drawReadiness: { present: true, ready: 1, blocked: 1 },
      diagnostics: { total: 7, info: 0, warnings: 6, errors: 1 },
    });
    expect(report.diagnostics).toHaveLength(4);
    expect(drawReadiness.diagnostics).toHaveLength(2);
    expect(
      JSON.stringify(renderWorldPreparedResourceSummaryToJsonValue(summary)),
    ).not.toContain("missing-report");
    expect(
      JSON.stringify(renderWorldPreparedResourceSummaryToJsonValue(summary)),
    ).not.toContain("GPU");
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
