import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createBoxMeshAsset,
  createMaterialHandle,
  createMeshHandle,
  createRenderSortKey,
  createUnlitMaterialAsset,
  type BatchCompatibilityKey,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";
import {
  indexQueuedSourceAssets,
  type QueuedSourceMaterialAsset,
  type QueuedSourceMeshAsset,
} from "@aperture-engine/webgpu";

describe("queued source asset indexing", () => {
  it("indexes ready source mesh and material assets once with versioned resource keys", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");
    const material = createMaterialHandle("white");
    const meshAsset = createBoxMeshAsset({ label: "Cube" });
    const materialAsset = createUnlitMaterialAsset({ label: "White" });
    const meshAssets = new Map();
    const materialAssets = new Map();

    registry.register(mesh);
    registry.register(material);
    registry.markReady(mesh, meshAsset);
    registry.markReady(material, materialAsset);

    indexQueuedSourceAssets(
      registry,
      renderSnapshot([
        drawPacket({ renderId: 1, meshId: "cube", materialId: "white" }),
        drawPacket({ renderId: 2, meshId: "cube", materialId: "white" }),
      ]),
      { meshAssets, materialAssets },
    );

    expect([...meshAssets.entries()]).toEqual([
      [
        "mesh:cube",
        {
          asset: meshAsset,
          resourceKey: "mesh:cube@1",
        },
      ],
    ]);
    expect([...materialAssets.entries()]).toEqual([
      [
        "material:white",
        {
          asset: materialAsset,
          kind: "unlit",
          resourceKey: "material:white@1",
          sourceVersion: 1,
        },
      ],
    ]);
  });

  it("clears stale output and skips missing, loading, and failed source assets", () => {
    const registry = new AssetRegistry();
    const readyMesh = createMeshHandle("ready");
    const loadingMesh = createMeshHandle("loading");
    const failedMesh = createMeshHandle("failed");
    const readyMaterial = createMaterialHandle("ready");
    const loadingMaterial = createMaterialHandle("loading");
    const failedMaterial = createMaterialHandle("failed");
    const meshAssets = new Map<string, QueuedSourceMeshAsset>([
      [
        "mesh:stale",
        {
          asset: createBoxMeshAsset({ label: "Stale" }),
          resourceKey: "stale",
        },
      ],
    ]);
    const materialAssets = new Map<string, QueuedSourceMaterialAsset>([
      [
        "material:stale",
        {
          asset: createUnlitMaterialAsset({ label: "Stale" }),
          kind: "unlit",
          resourceKey: "stale",
          sourceVersion: 1,
        },
      ],
    ]);

    for (const handle of [readyMesh, loadingMesh, failedMesh]) {
      registry.register(handle);
    }
    for (const handle of [readyMaterial, loadingMaterial, failedMaterial]) {
      registry.register(handle);
    }

    registry.markReady(readyMesh, createBoxMeshAsset({ label: "Ready" }));
    registry.markLoading(loadingMesh);
    registry.markFailed(failedMesh, [
      { code: "mesh.failed", message: "mesh failed", severity: "error" },
    ]);
    registry.markReady(
      readyMaterial,
      createUnlitMaterialAsset({ label: "Ready" }),
    );
    registry.markLoading(loadingMaterial);
    registry.markFailed(failedMaterial, [
      {
        code: "material.failed",
        message: "material failed",
        severity: "error",
      },
    ]);

    indexQueuedSourceAssets(
      registry,
      renderSnapshot([
        drawPacket({ renderId: 3, meshId: "ready", materialId: "ready" }),
        drawPacket({ renderId: 4, meshId: "loading", materialId: "loading" }),
        drawPacket({ renderId: 5, meshId: "failed", materialId: "failed" }),
        drawPacket({ renderId: 6, meshId: "missing", materialId: "missing" }),
      ]),
      { meshAssets, materialAssets },
    );

    expect([...meshAssets.keys()]).toEqual(["mesh:ready"]);
    expect([...materialAssets.keys()]).toEqual(["material:ready"]);
  });
});

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
  readonly meshId: string;
  readonly materialId: string;
}): MeshDrawPacket {
  const meshKey = `mesh:${options.meshId}`;
  const materialKey = `material:${options.materialId}`;
  const pipelineKey = "unlit|opaque|back|less|none";

  return {
    renderId: options.renderId,
    entity: { index: options.renderId, generation: 1 },
    mesh: createMeshHandle(options.meshId),
    material: createMaterialHandle(options.materialId),
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
