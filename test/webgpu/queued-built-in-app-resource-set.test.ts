import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createMaterialHandle,
  createMaterialQueueScratch,
  createMeshHandle,
  createPreparedMaterialStore,
  createPreparedMeshStore,
  createRenderSortKey,
  createUnlitMaterialAsset,
  prepareSnapshotMaterials,
  prepareSnapshotMeshes,
  type BatchCompatibilityKey,
  type MaterialAsset,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";
import {
  collectQueuedBuiltInAppResourceSet,
  createQueuedBuiltInAppRouteCollectorScratch,
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
} from "@aperture-engine/webgpu";

describe("queued built-in app resource set collector", () => {
  it("collects a routed built-in resource item without exposing GPU handles", () => {
    const assets = readyAssets("unlit");
    const snapshot = renderSnapshot([
      drawPacket({ renderId: 3, materialFamily: "unlit" }),
    ]);
    const meshes = createPreparedMeshStore();
    const materials = createPreparedMaterialStore();

    prepareSnapshotMeshes({ registry: assets, snapshot, meshes });
    prepareSnapshotMaterials({ registry: assets, snapshot, materials });

    const result = collectQueuedBuiltInAppResourceSet({
      assets,
      snapshot,
      materialQueueScratch: createMaterialQueueScratch(),
      routeScratch: routeScratch(),
      meshes,
      materials,
      adapters: adapters(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resourceSet?.items).toHaveLength(1);
    expect(result.resourceSet?.items[0]).toMatchObject({
      meshKey: "mesh:cube@1",
      materialKey: "material:white@1",
      sourceMeshKey: "mesh:cube",
      sourceMaterialKey: "material:white",
      queueItem: {
        renderId: 3,
        materialFamily: "unlit",
        meshResourceKey: "prepared-mesh:mesh:cube",
        materialResourceKey: "prepared-material:material:white",
      },
    });
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
  });

  it("reports unsupported material families with a JSON-safe route report", () => {
    const assets = readyAssets("debug-normal");
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 7,
        materialFamily: "debug-normal",
        materialId: "debug",
      }),
    ]);
    const meshes = createPreparedMeshStore();
    const materials = createPreparedMaterialStore();

    prepareSnapshotMeshes({ registry: assets, snapshot, meshes });
    prepareSnapshotMaterials({ registry: assets, snapshot, materials });

    const result = collectQueuedBuiltInAppResourceSet({
      assets,
      snapshot,
      materialQueueScratch: createMaterialQueueScratch(),
      routeScratch: routeScratch(),
      meshes,
      materials,
      adapters: adapters(),
    });

    expect(result.valid).toBe(false);
    expect(result.resourceSet).toBeNull();
    expect(result.diagnostics).toMatchObject([
      {
        code: "webGpuApp.unsupportedMaterialQueueFamily",
        renderId: 7,
        drawIndex: 0,
        materialFamily: "debug-normal",
      },
      {
        code: "webGpuApp.materialQueueRouteReport",
        report: {
          valid: false,
          queueItemCount: 1,
          routedItemCount: 0,
          skippedItemCount: 1,
          byFamily: [
            {
              key: "debug-normal",
              queuedCount: 1,
              routedCount: 0,
              skippedCount: 1,
            },
          ],
        },
      },
    ]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
  });
});

function adapters() {
  const unused = () => {
    throw new Error("Frame-resource callbacks are not used by collection.");
  };

  return createQueuedBuiltInAppResourceAdapterRegistry({
    families: createQueuedBuiltInAppResourceFamilyAdapterTable({
      prepareUnlitTextureSamplerResources: unused,
      prepareMatcapTextureSamplerResources: unused,
      prepareStandardTextureSamplerResources: unused,
      createUnlitFrameResources: unused,
      createMatcapFrameResources: unused,
      createStandardFrameResources: unused,
    }),
  });
}

function routeScratch() {
  return createQueuedBuiltInAppRouteCollectorScratch();
}

function readyAssets(materialFamily: "unlit" | "debug-normal"): AssetRegistry {
  const registry = new AssetRegistry();
  const mesh = createMeshHandle("cube");
  const material = createMaterialHandle(
    materialFamily === "debug-normal" ? "debug" : "white",
  );
  const materialAsset: MaterialAsset =
    materialFamily === "debug-normal"
      ? createDebugNormalMaterialAsset({ label: "Debug Normals" })
      : createUnlitMaterialAsset({ label: "White" });

  registry.register(mesh);
  registry.register(material);
  registry.markReady(mesh, createBoxMeshAsset({ label: "Cube" }));
  registry.markReady(material, materialAsset);

  return registry;
}

function renderSnapshot(meshDraws: readonly MeshDrawPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
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

function drawPacket(options: {
  readonly renderId: number;
  readonly materialFamily: string;
  readonly materialId?: string;
}): MeshDrawPacket {
  const meshKey = "mesh:cube";
  const materialKey = `material:${options.materialId ?? "white"}`;
  const pipelineKey = `${options.materialFamily}|opaque|back|less|none`;

  return {
    renderId: options.renderId,
    entity: { index: options.renderId, generation: 1 },
    mesh: createMeshHandle("cube"),
    material: createMaterialHandle(options.materialId ?? "white"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: "opaque",
      pipelineKey,
      materialKey,
      meshKey,
      depth: 0,
      stableId: options.renderId,
    }),
    batchKey: batchKey(pipelineKey, materialKey),
  };
}

function batchKey(
  pipelineKey: string,
  materialKey: string,
): BatchCompatibilityKey {
  return {
    pipelineKey,
    materialKey,
    meshLayoutKey: "POSITION,NORMAL,UV_0",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
  };
}
