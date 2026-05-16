import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createRenderQueueScratch,
  createRenderSortKey,
  planRenderQueueRecords,
  writeRenderQueueRecords,
  type BatchCompatibilityKey,
  type PackedSnapshotTransforms,
  type RenderWorldDrawReadinessReport,
} from "@aperture-engine/core";

const BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:white",
  meshLayoutKey: "mesh-layout:cube",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("render queue records", () => {
  it("creates default opaque main-pass queue records in stable sort order", () => {
    const plan = planRenderQueueRecords(readiness([9, 7]), transforms([7, 9]));

    expect(plan.diagnostics).toEqual([]);
    expect(
      plan.records.map((record) => ({
        renderId: record.renderId,
        viewId: record.viewId,
        passId: record.passId,
        queueKind: record.queueKind,
        pipelineKey: record.pipelineKey,
        materialKey: record.materialKey,
        meshLayoutKey: record.meshLayoutKey,
      })),
    ).toEqual([
      {
        renderId: 7,
        viewId: "default",
        passId: "main",
        queueKind: "opaque",
        pipelineKey: "pipeline:unlit",
        materialKey: "material:white",
        meshLayoutKey: "mesh-layout:cube",
      },
      {
        renderId: 9,
        viewId: "default",
        passId: "main",
        queueKind: "opaque",
        pipelineKey: "pipeline:unlit",
        materialKey: "material:white",
        meshLayoutKey: "mesh-layout:cube",
      },
    ]);
  });

  it("supports explicit view, pass, and queue scope", () => {
    const plan = planRenderQueueRecords(readiness([1]), transforms([1]), {
      scope: {
        viewId: "view:main-camera",
        passId: "pass:forward",
        queueKind: "transparent",
      },
    });

    expect(plan.records).toMatchObject([
      {
        renderId: 1,
        viewId: "view:main-camera",
        passId: "pass:forward",
        queueKind: "transparent",
      },
    ]);
  });

  it("can reuse caller-owned scratch records on a steady-state hot path", () => {
    const scratch = createRenderQueueScratch(2);
    const first = writeRenderQueueRecords(
      readiness([1, 2]),
      transforms([1, 2]),
      scratch,
    );
    const firstRecords = [...first.records];
    const second = writeRenderQueueRecords(
      readiness([2, 1]),
      transforms([1, 2]),
      scratch,
    );

    expect(new Set(second.records)).toEqual(new Set(firstRecords));
    expect(second.records.map((record) => record.renderId)).toEqual([1, 2]);
  });

  it("keeps blocked and missing transform diagnostics in the queue phase input", () => {
    const plan = planRenderQueueRecords(
      {
        ready: [readyDraw(1), readyDraw(2)],
        blocked: [
          {
            renderId: 3,
            packet: packet(3),
            missing: ["missing-mesh-resource"],
          },
        ],
        diagnostics: [],
      },
      transforms([1]),
    );

    expect(plan.records.map((record) => record.renderId)).toEqual([1]);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderDrawPackage.blockedDraw",
      "renderDrawPackage.missingPackedTransform",
    ]);
  });
});

function readiness(
  renderIds: readonly number[],
): RenderWorldDrawReadinessReport {
  return {
    ready: renderIds.map(readyDraw),
    blocked: [],
    diagnostics: [],
  };
}

function readyDraw(renderId: number) {
  return {
    renderId,
    packet: packet(renderId),
    meshResourceKey: "mesh:cube",
    materialResourceKey: "material:white",
    batchKey: BATCH_KEY,
  };
}

function packet(renderId: number) {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: createMeshHandle("cube"),
    material: createMaterialHandle("white"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: renderId * 16,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: sortKey(renderId),
    batchKey: BATCH_KEY,
  };
}

function transforms(renderIds: readonly number[]): PackedSnapshotTransforms {
  return {
    data: new Float32Array(renderIds.length * 16),
    offsets: renderIds.map((renderId, index) => ({
      renderId,
      sourceOffset: renderId * 16,
      packedOffset: index * 16,
    })),
    diagnostics: [],
  };
}

function sortKey(renderId: number) {
  return createRenderSortKey({
    stableId: renderId,
    order: renderId,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:white",
    meshKey: "mesh:cube",
  });
}
