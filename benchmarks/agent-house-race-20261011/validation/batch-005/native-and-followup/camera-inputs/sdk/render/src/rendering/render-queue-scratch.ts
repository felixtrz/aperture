import {
  DEFAULT_RENDER_QUEUE_PASS_ID,
  DEFAULT_RENDER_QUEUE_VIEW_ID,
  type MutableRenderQueueRecord,
  type RenderQueueRecord,
  type RenderQueueScratch,
  type RenderQueueSortPhaseReport,
} from "./render-queue-types.js";
import { renderQueueSortPolicyForPhase } from "./render-queue-sort.js";
import type { RenderWorldReadyDraw } from "./render-world.js";

export function createRenderQueueScratch(capacity = 0): RenderQueueScratch {
  const recordPool: RenderQueueRecord[] = [];
  const records: RenderQueueRecord[] = [];
  const diagnostics: RenderQueueScratch["diagnostics"] = [];
  const sortPhases: RenderQueueSortPhaseReport[] = [];
  const sortPhasePool: RenderQueueSortPhaseReport[] = [
    {
      phase: "opaque",
      recordCount: 0,
      sortPolicy: renderQueueSortPolicyForPhase("opaque"),
    },
    {
      phase: "transparent",
      recordCount: 0,
      sortPolicy: renderQueueSortPolicyForPhase("transparent"),
    },
  ];

  for (let i = 0; i < capacity; i += 1) {
    recordPool.push(createEmptyRenderQueueRecord());
  }

  return {
    records,
    diagnostics,
    sortPhases,
    sortPhasePool,
    recordPool,
    plan: { records, diagnostics, sortPhases },
  };
}

export function renderQueueRecordAt(
  scratch: RenderQueueScratch,
  index: number,
): MutableRenderQueueRecord {
  const existing = scratch.recordPool[index] as
    | MutableRenderQueueRecord
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const record = createEmptyRenderQueueRecord();

  scratch.recordPool.push(record);
  return record;
}

function createEmptyRenderQueueRecord(): MutableRenderQueueRecord {
  return {
    renderId: 0,
    sortOrdinal: 0,
    viewId: DEFAULT_RENDER_QUEUE_VIEW_ID,
    passId: DEFAULT_RENDER_QUEUE_PASS_ID,
    queueKind: "opaque",
    packet: null as unknown as RenderWorldReadyDraw["packet"],
    submesh: 0,
    materialSlot: 0,
    meshResourceKey: "",
    materialResourceKey: "",
    pipelineKey: "",
    materialKey: "",
    meshLayoutKey: "",
    batchKey: null as unknown as RenderWorldReadyDraw["batchKey"],
    sortKey: null as unknown as RenderWorldReadyDraw["packet"]["sortKey"],
    transformPackedOffset: 0,
    instanceCount: 1,
    drawKind: "single",
    sourceRecordCount: 1,
    sourceRenderIds: [],
    sourceMeshResourceKeys: [],
  };
}
