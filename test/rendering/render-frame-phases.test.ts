import { describe, expect, it } from "vitest";
import {
  RENDER_FRAME_PHASE_ORDER,
  createRenderQueueScratch,
  createRenderSortKey,
  describeRenderFramePhases,
  writeRenderFrameQueuePhase,
  writeRenderFrameSortPhase,
  type BatchCompatibilityKey,
  type PackedSnapshotTransforms,
  type RenderWorldDrawReadinessReport,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";

const BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:white",
  meshLayoutKey: "mesh-layout:cube",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("render frame phase helpers", () => {
  it("documents the extract, prepare, queue, sort, and submit boundaries", () => {
    expect(RENDER_FRAME_PHASE_ORDER).toEqual([
      "extract",
      "asset-change-collection",
      "prepare",
      "queue",
      "sort",
      "submit",
    ]);
    expect(describeRenderFramePhases().map((phase) => phase.name)).toEqual(
      RENDER_FRAME_PHASE_ORDER,
    );
    expect(describeRenderFramePhases().map((phase) => phase.summary)).toContain(
      "Prepare renderer-owned resources from ready source assets and extracted data.",
    );
  });

  it("queues current draw packets before sorting them through named phases", () => {
    const scratch = createRenderQueueScratch(2);
    const queued = writeRenderFrameQueuePhase(
      readiness([9, 7]),
      transforms([7, 9]),
      scratch,
    );

    expect(queued.phase).toBe("queue");
    expect(queued.records.map((record) => record.renderId)).toEqual([9, 7]);
    expect(queued.diagnostics).toEqual([]);

    const sorted = writeRenderFrameSortPhase(scratch);

    expect(sorted.phase).toBe("sort");
    expect(sorted.records.map((record) => record.renderId)).toEqual([7, 9]);
    expect(sorted.records).toBe(queued.records);
  });

  it("can apply static batching during the named sort phase", () => {
    const scratch = createRenderQueueScratch(4);

    writeRenderFrameQueuePhase(
      readiness([1, 2, 3, 4], (renderId) => `mesh:${renderId}`),
      transforms([1, 2, 3, 4]),
      scratch,
    );
    const sorted = writeRenderFrameSortPhase(scratch, {
      staticBatching: { enabled: true, maxRecordsPerBatch: 2 },
    });

    expect(sorted.records).toHaveLength(2);
    expect(sorted.records.map((record) => record.drawKind)).toEqual([
      "static-merged",
      "static-merged",
    ]);
    expect(sorted.records.map((record) => record.sourceRecordCount)).toEqual([
      2, 2,
    ]);
  });
});

function readiness(
  renderIds: readonly number[],
  meshResourceKey: (renderId: number) => string = () => "mesh:cube",
): RenderWorldDrawReadinessReport {
  return {
    ready: renderIds.map((renderId) =>
      readyDraw(renderId, meshResourceKey(renderId)),
    ),
    blocked: [],
    diagnostics: [],
  };
}

function readyDraw(renderId: number, meshResourceKey = "mesh:cube") {
  return {
    renderId,
    packet: packet(renderId),
    meshResourceKey,
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
    sortKey: createRenderSortKey({
      stableId: renderId,
      order: renderId,
      pipelineKey: "pipeline:unlit",
      materialKey: "material:white",
      meshKey: "mesh:cube",
    }),
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
