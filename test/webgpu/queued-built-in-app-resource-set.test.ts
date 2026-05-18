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
  createStandardMaterialAsset,
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
    const item = result.resourceSet?.items[0];

    expect(item).toMatchObject({
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
    expect(item?.prepareRoute).toEqual({
      valid: true,
      status: "prepared",
      family: "unlit",
      materialKey: "material:white",
      meshResourceKey: "prepared-mesh:mesh:cube",
      materialResourceKey: "prepared-material:material:white",
      pipelineKey: "unlit|opaque|back|less|none",
      sourceVersion: 1,
      frame: 1,
      diagnostics: [],
    });
    expect(item?.adapter.kind).toBe("unlit");
    expect(item?.draw.renderId).toBe(3);
    expect(
      (item as unknown as { readonly customPreview?: unknown }).customPreview,
    ).toBe(undefined);
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
    expect(JSON.stringify(result)).not.toContain("customPreviewResourceSet");
  });

  it("collects debug-normal resource items with JSON-safe route metadata", () => {
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

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resourceSet?.items).toHaveLength(1);
    expect(result.resourceSet?.items[0]).toMatchObject({
      queueItem: {
        renderId: 7,
        materialFamily: "debug-normal",
        meshResourceKey: "prepared-mesh:mesh:cube",
        materialResourceKey: "prepared-material:material:debug",
      },
      prepareRoute: {
        valid: true,
        status: "prepared",
        family: "debug-normal",
        materialKey: "material:debug",
        meshResourceKey: "prepared-mesh:mesh:cube",
        materialResourceKey: "prepared-material:material:debug",
        pipelineKey: "debug-normal|opaque|back|less|none",
        sourceVersion: 1,
        frame: 1,
        diagnostics: [],
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
  });

  it("keeps StandardMaterial route identity aligned with generic app route fields", () => {
    const assets = readyAssets("standard");
    const snapshot = renderSnapshot([
      drawPacket({ renderId: 11, materialFamily: "standard" }),
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
    const item = result.resourceSet?.items[0];

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(item).toMatchObject({
      meshKey: "mesh:cube@1",
      materialKey: "material:white@1",
      sourceMeshKey: "mesh:cube",
      sourceMaterialKey: "material:white",
      queueItem: {
        renderId: 11,
        materialFamily: "standard",
        pipelineKey: "standard|opaque|back|less|none",
        meshResourceKey: "prepared-mesh:mesh:cube",
        materialResourceKey: "prepared-material:material:white",
      },
      prepareRoute: {
        valid: true,
        status: "prepared",
        family: "standard",
        materialKey: "material:white",
        meshResourceKey: "prepared-mesh:mesh:cube",
        materialResourceKey: "prepared-material:material:white",
        pipelineKey: "standard|opaque|back|less|none",
        sourceVersion: 1,
        frame: 1,
        diagnostics: [],
      },
    });
    expect(item?.adapter.kind).toBe("standard");
    expect(
      (item as unknown as { readonly standardResourceSet?: unknown })
        .standardResourceSet,
    ).toBe(undefined);
    expect(JSON.stringify(result)).not.toContain("standardResourceSet");
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
  });

  it("reports unsupported route families without routed resources or raw handles", () => {
    const assets = readyAssets("unlit");
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 13,
        materialFamily: "toon-shaded",
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
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueFamily",
          renderId: 13,
          drawIndex: 0,
          materialFamily: "toon-shaded",
          entity: { index: 13, generation: 1 },
        }),
        expect.objectContaining({
          code: "webGpuApp.materialQueueRouteReport",
          report: expect.objectContaining({
            valid: false,
            queueItemCount: 1,
            routedItemCount: 0,
            skippedItemCount: 1,
            byFamily: [
              {
                key: "toon-shaded",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              },
            ],
            byPhase: [
              {
                key: "opaque",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              },
            ],
            diagnosticSummary: expect.objectContaining({
              total: 1,
              byCode: {
                "webGpuApp.unsupportedMaterialQueueFamily": 1,
              },
            }),
          }),
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /rawGpuHandle|sourceAsset|GPUDevice|GPUBuffer|GPUTexture|bindGroup/,
    );
  });

  it("resets reusable route scratch between unsupported and valid collections", () => {
    const sharedRouteScratch = routeScratch();
    const sharedMaterialQueueScratch = createMaterialQueueScratch();
    const unsupportedAssets = readyAssets("unlit");
    const unsupportedSnapshot = renderSnapshot([
      drawPacket({
        renderId: 17,
        materialFamily: "toon-shaded",
      }),
    ]);
    const unsupportedMeshes = createPreparedMeshStore();
    const unsupportedMaterials = createPreparedMaterialStore();

    prepareSnapshotMeshes({
      registry: unsupportedAssets,
      snapshot: unsupportedSnapshot,
      meshes: unsupportedMeshes,
    });
    prepareSnapshotMaterials({
      registry: unsupportedAssets,
      snapshot: unsupportedSnapshot,
      materials: unsupportedMaterials,
    });

    const unsupported = collectQueuedBuiltInAppResourceSet({
      assets: unsupportedAssets,
      snapshot: unsupportedSnapshot,
      materialQueueScratch: sharedMaterialQueueScratch,
      routeScratch: sharedRouteScratch,
      meshes: unsupportedMeshes,
      materials: unsupportedMaterials,
      adapters: adapters(),
    });

    expect(unsupported.valid).toBe(false);
    expect(JSON.stringify(unsupported)).toContain("toon-shaded");

    const validAssets = readyAssets("standard");
    const validSnapshot = renderSnapshot([
      drawPacket({ renderId: 18, materialFamily: "standard" }),
    ]);
    const validMeshes = createPreparedMeshStore();
    const validMaterials = createPreparedMaterialStore();

    prepareSnapshotMeshes({
      registry: validAssets,
      snapshot: validSnapshot,
      meshes: validMeshes,
    });
    prepareSnapshotMaterials({
      registry: validAssets,
      snapshot: validSnapshot,
      materials: validMaterials,
    });

    const valid = collectQueuedBuiltInAppResourceSet({
      assets: validAssets,
      snapshot: validSnapshot,
      materialQueueScratch: sharedMaterialQueueScratch,
      routeScratch: sharedRouteScratch,
      meshes: validMeshes,
      materials: validMaterials,
      adapters: adapters(),
    });

    expect(valid.valid).toBe(true);
    expect(valid.diagnostics).toEqual([]);
    expect(valid.resourceSet?.items).toHaveLength(1);
    expect(valid.resourceSet?.items[0]).toMatchObject({
      queueItem: {
        renderId: 18,
        materialFamily: "standard",
      },
      prepareRoute: {
        valid: true,
        family: "standard",
      },
    });
    expect(JSON.stringify(valid)).not.toContain("debug-normal");
    expect(JSON.stringify(valid)).not.toContain("toon-shaded");
    expect(JSON.stringify(valid)).not.toContain(
      "webGpuApp.materialQueueRouteReport",
    );
    expect(JSON.stringify(valid)).not.toContain("rawGpuHandle");
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
      prepareDebugNormalTextureSamplerResources: unused,
      createUnlitFrameResources: unused,
      createMatcapFrameResources: unused,
      createStandardFrameResources: unused,
      createDebugNormalFrameResources: unused,
    }),
  });
}

function routeScratch() {
  return createQueuedBuiltInAppRouteCollectorScratch();
}

function readyAssets(
  materialFamily: "unlit" | "debug-normal" | "standard",
): AssetRegistry {
  const registry = new AssetRegistry();
  const mesh = createMeshHandle("cube");
  const material = createMaterialHandle(
    materialFamily === "debug-normal" ? "debug" : "white",
  );
  const materialAsset: MaterialAsset =
    materialFamily === "debug-normal"
      ? createDebugNormalMaterialAsset({ label: "Debug Normals" })
      : materialFamily === "standard"
        ? createStandardMaterialAsset({ label: "Standard White" })
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
