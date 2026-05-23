import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createRenderQueueScratch,
  createRenderSortKey,
  planRenderQueueRecords,
  renderQueueSortPolicyForPhase,
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
    expect(plan.sortPhases).toEqual([sortPhase("opaque", 2)]);
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
    expect(plan.sortPhases).toEqual([sortPhase("transparent", 1)]);
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
      drawKind: "instanced",
      sourceRecordCount: 100,
      transformPackedOffset: 0,
    });
    expect(plan.records[0]?.sourceRenderIds).toEqual(renderIds);
    expect(plan.sortPhases).toEqual([sortPhase("opaque", 1)]);
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
    expect(plan.records.map((record) => record.drawKind)).toEqual([
      "single",
      "single",
    ]);
    expect(plan.sortPhases).toEqual([sortPhase("opaque", 2)]);
  });

  it("plans static merged batches for adjacent distinct opaque meshes", () => {
    const renderIds = Array.from({ length: 20 }, (_, index) => index + 1);
    const plan = planRenderQueueRecords(
      {
        ready: renderIds.map((renderId) =>
          readyDraw(renderId, {
            meshResourceKey: `mesh:distinct-${renderId}`,
          }),
        ),
        blocked: [],
        diagnostics: [],
      },
      transforms(renderIds),
      { staticBatching: { enabled: true } },
    );

    expect(plan.diagnostics).toEqual([]);
    expect(plan.records).toHaveLength(5);
    expect(plan.records.map((record) => record.drawKind)).toEqual([
      "static-merged",
      "static-merged",
      "static-merged",
      "static-merged",
      "static-merged",
    ]);
    expect(plan.records.map((record) => record.sourceRecordCount)).toEqual([
      4, 4, 4, 4, 4,
    ]);
    expect(plan.records[0]?.sourceRenderIds).toEqual([1, 2, 3, 4]);
    expect(plan.records[0]?.sourceMeshResourceKeys).toEqual([
      "mesh:distinct-1",
      "mesh:distinct-2",
      "mesh:distinct-3",
      "mesh:distinct-4",
    ]);
    expect(plan.records.every((record) => record.instanceCount === 1)).toBe(
      true,
    );
    expect(plan.sortPhases).toEqual([sortPhase("opaque", 5)]);
  });

  it("reports opaque and transparent sort phases for mixed queues", () => {
    const plan = planRenderQueueRecords(
      {
        ready: [
          readyDraw(1),
          readyDraw(2, { queue: "transparent" }),
          readyDraw(3),
          readyDraw(4, { queue: "transparent" }),
        ],
        blocked: [],
        diagnostics: [],
      },
      transforms([1, 2, 3, 4]),
    );

    expect(plan.records.map((record) => record.queueKind)).toEqual([
      "opaque",
      "opaque",
      "transparent",
      "transparent",
    ]);
    expect(plan.sortPhases).toEqual([
      sortPhase("opaque", 2),
      sortPhase("transparent", 2),
    ]);
  });

  it("sorts equal-depth transparent records by stable tie-breaks without native sort stability", () => {
    const plan = planRenderQueueRecords(
      {
        ready: [
          readyDraw(30, {
            queue: "transparent",
            depth: 12,
            order: 0,
            stableId: 2,
          }),
          readyDraw(20, {
            queue: "transparent",
            depth: 12,
            order: 0,
            stableId: 1,
          }),
          readyDraw(10, {
            queue: "transparent",
            depth: 12,
            order: 0,
            stableId: 1,
          }),
        ],
        blocked: [],
        diagnostics: [],
      },
      transforms([10, 20, 30]),
    );

    expect(plan.records.map((record) => record.renderId)).toEqual([10, 20, 30]);
    expect(plan.records.map((record) => record.sortOrdinal)).toEqual([2, 1, 0]);
    expect(plan.sortPhases).toEqual([sortPhase("transparent", 3)]);
    expect(plan.sortPhases[0]?.sortPolicy).toMatchObject({
      name: "transparent-order-back-to-front-stable",
      depthOrder: "back-to-front",
      tieBreakers: expect.arrayContaining([
        "stableId",
        "renderId",
        "sortOrdinal",
      ]),
      totalOrder: true,
    });
  });

  it("orders transparent records back-to-front before stable ids", () => {
    const plan = planRenderQueueRecords(
      {
        ready: [
          readyDraw(1, {
            queue: "transparent",
            depth: 3,
            order: 0,
            stableId: 1,
          }),
          readyDraw(2, {
            queue: "transparent",
            depth: 9,
            order: 0,
            stableId: 99,
          }),
        ],
        blocked: [],
        diagnostics: [],
      },
      transforms([1, 2]),
    );

    expect(plan.records.map((record) => record.renderId)).toEqual([2, 1]);
  });

  it("does not plan static merged batches for transparent or animated records", () => {
    const renderIds = [1, 2, 3, 4];
    const transparent = planRenderQueueRecords(
      {
        ready: renderIds.map((renderId) =>
          readyDraw(renderId, {
            meshResourceKey: `mesh:transparent-${renderId}`,
          }),
        ),
        blocked: [],
        diagnostics: [],
      },
      transforms(renderIds),
      {
        scope: { queueKind: "transparent" },
        staticBatching: { enabled: true },
      },
    );
    const skinned = planRenderQueueRecords(
      {
        ready: renderIds.map((renderId) =>
          readyDraw(renderId, {
            meshResourceKey: `mesh:skinned-${renderId}`,
            batchKey: { ...BATCH_KEY, skinned: true },
          }),
        ),
        blocked: [],
        diagnostics: [],
      },
      transforms(renderIds),
      { staticBatching: { enabled: true } },
    );

    expect(transparent.records).toHaveLength(4);
    expect(transparent.records.map((record) => record.drawKind)).toEqual([
      "single",
      "single",
      "single",
      "single",
    ]);
    expect(transparent.sortPhases).toEqual([sortPhase("transparent", 4)]);
    expect(skinned.records).toHaveLength(4);
    expect(skinned.records.map((record) => record.drawKind)).toEqual([
      "single",
      "single",
      "single",
      "single",
    ]);
    expect(skinned.sortPhases).toEqual([sortPhase("opaque", 4)]);
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

function sortPhase(phase: "opaque" | "transparent", recordCount: number) {
  return {
    phase,
    recordCount,
    sortPolicy: renderQueueSortPolicyForPhase(phase),
  };
}

function readyDraw(
  renderId: number,
  overrides: {
    readonly meshResourceKey?: string;
    readonly batchKey?: BatchCompatibilityKey;
    readonly queue?: "opaque" | "alpha-test" | "transparent";
    readonly order?: number;
    readonly depth?: number;
    readonly stableId?: number;
  } = {},
) {
  const batchKey = overrides.batchKey ?? BATCH_KEY;

  return {
    renderId,
    packet: packet(renderId, batchKey, overrides),
    meshResourceKey: overrides.meshResourceKey ?? `mesh:${renderId}`,
    materialResourceKey: "material:white",
    batchKey,
  };
}

function packet(
  renderId: number,
  batchKey = BATCH_KEY,
  overrides: {
    readonly queue?: "opaque" | "alpha-test" | "transparent";
    readonly order?: number;
    readonly depth?: number;
    readonly stableId?: number;
  } = {},
) {
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
    sortKey: sortKey(renderId, overrides),
    batchKey,
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

function sortKey(
  renderId: number,
  overrides: {
    readonly queue?: "opaque" | "alpha-test" | "transparent";
    readonly order?: number;
    readonly depth?: number;
    readonly stableId?: number;
  } = {},
) {
  return createRenderSortKey({
    queue: overrides.queue ?? "opaque",
    stableId: overrides.stableId ?? renderId,
    order: overrides.order ?? renderId,
    depth: overrides.depth ?? 0,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:white",
    meshKey: "mesh:cube",
  });
}
