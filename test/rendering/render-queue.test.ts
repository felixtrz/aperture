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

  it("coalesces compatible records with contiguous transform slots", () => {
    const renderIds = Array.from({ length: 100 }, (_, index) => index + 1);
    const plan = planRenderQueueRecords(
      {
        ready: renderIds.map((renderId) =>
          readyDraw(renderId, { meshResourceKey: "mesh:cube" }),
        ),
        blocked: [],
        diagnostics: [],
      },
      transforms(renderIds),
    );

    expect(plan.diagnostics).toEqual([]);
    expect(plan.records).toHaveLength(1);
    expect(plan.records[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: "mesh:cube",
      instanceCount: 100,
      transformPackedOffset: 0,
    });
  });

  it("does not coalesce compatible records with non-contiguous transform slots", () => {
    const plan = planRenderQueueRecords(
      {
        ready: [
          readyDraw(1, { meshResourceKey: "mesh:cube" }),
          readyDraw(2, { meshResourceKey: "mesh:cube" }),
        ],
        blocked: [],
        diagnostics: [],
      },
      {
        data: new Float32Array(64),
        offsets: [
          { renderId: 1, sourceOffset: 0, packedOffset: 0 },
          { renderId: 2, sourceOffset: 48, packedOffset: 48 },
        ],
        diagnostics: [],
      },
    );

    expect(plan.records.map((record) => record.instanceCount)).toEqual([1, 1]);
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
    ready: renderIds.map((renderId) => readyDraw(renderId)),
    blocked: [],
    diagnostics: [],
  };
}

function readyDraw(
  renderId: number,
  overrides: { readonly meshResourceKey?: string } = {},
) {
  return {
    renderId,
    packet: packet(renderId),
    meshResourceKey: overrides.meshResourceKey ?? `mesh:${renderId}`,
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
