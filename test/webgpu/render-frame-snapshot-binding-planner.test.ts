import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  planInjectedRenderFrameSnapshotResourceBindings,
  type BatchCompatibilityKey,
  type MeshDrawPacket,
  type RenderSnapshot,
  type RenderSortKey,
} from "../../src/index.js";

type MissingResource = "mesh" | "material";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("snapshot render frame resource binding planner", () => {
  it("creates stable ordered binding updates for ready snapshots", () => {
    const result = plan(snapshot([packet(9), packet(7)]));

    expect(result.diagnostics).toEqual([]);
    expect(result.bindings).toEqual([
      {
        renderId: 7,
        update: {
          meshResourceKey: "mesh:triangle-7",
          materialResourceKey: "material:red-7",
        },
      },
      {
        renderId: 9,
        update: {
          meshResourceKey: "mesh:triangle-9",
          materialResourceKey: "material:red-9",
        },
      },
    ]);
  });

  it("reports missing mesh resources while preserving material bindings", () => {
    const result = plan(snapshot([packet(7), packet(9)]), "mesh");

    expect(result.diagnostics).toMatchObject([
      {
        code: "renderFrameSnapshotBinding.missingMeshResource",
        severity: "warning",
        assetKey: "triangle-9",
      },
    ]);
    expect(result.bindings).toEqual([
      {
        renderId: 7,
        update: {
          meshResourceKey: "mesh:triangle-7",
          materialResourceKey: "material:red-7",
        },
      },
      {
        renderId: 9,
        update: {
          materialResourceKey: "material:red-9",
        },
      },
    ]);
  });

  it("reports missing material resources while preserving mesh bindings", () => {
    const result = plan(snapshot([packet(7), packet(9)]), "material");

    expect(result.diagnostics).toMatchObject([
      {
        code: "renderFrameSnapshotBinding.missingMaterialResource",
        severity: "warning",
        assetKey: "red-9",
      },
    ]);
    expect(result.bindings).toEqual([
      {
        renderId: 7,
        update: {
          meshResourceKey: "mesh:triangle-7",
          materialResourceKey: "material:red-7",
        },
      },
      {
        renderId: 9,
        update: {
          meshResourceKey: "mesh:triangle-9",
        },
      },
    ]);
  });

  it("reports duplicate render ids and keeps the first binding", () => {
    const duplicate = { ...packet(11), renderId: 9 };
    const result = plan(snapshot([packet(9), packet(7), duplicate]));

    expect(result.diagnostics).toMatchObject([
      {
        code: "renderFrameSnapshotBinding.duplicateRenderId",
        severity: "error",
      },
    ]);
    expect(result.bindings.map((binding) => binding.renderId)).toEqual([7, 9]);
    expect(result.bindings[1]).toMatchObject({
      renderId: 9,
      update: {
        meshResourceKey: "mesh:triangle-9",
        materialResourceKey: "material:red-9",
      },
    });
  });
});

function plan(snapshotValue: RenderSnapshot, missing?: MissingResource) {
  return planInjectedRenderFrameSnapshotResourceBindings({
    snapshot: snapshotValue,
    resolveMeshResourceKey: (draw) =>
      missing === "mesh" && draw.renderId === 9 ? null : `mesh:${draw.mesh.id}`,
    resolveMaterialResourceKey: (draw) =>
      missing === "material" && draw.renderId === 9
        ? null
        : `material:${draw.material.id}`,
  });
}

function packet(renderId: number): MeshDrawPacket {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: createMeshHandle(`triangle-${renderId}`),
    material: createMaterialHandle(`red-${renderId}`),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: renderId * 16,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: sortKey(renderId),
    batchKey: BATCH,
  };
}

function sortKey(stableId: number): RenderSortKey {
  return {
    queue: "opaque",
    viewId: 0,
    layer: 0,
    order: 0,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:red",
    meshKey: "mesh:triangle",
    depth: 0,
    stableId,
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
    transforms: new Float32Array(32),
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
