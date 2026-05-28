import {
  type MutableRenderQueueRecord,
  type MutableRenderQueueSortPhaseReport,
  type ReadyDrawBatchKey,
  type RenderQueueKind,
  type RenderQueueRecord,
  type RenderQueueSortPhaseReport,
  type RenderQueueSortPolicyReport,
  type RenderQueueStaticBatchingOptions,
} from "./render-queue-types.js";
import {
  compareStateAwareRenderRecords,
  OPAQUE_STATE_SORT_POLICY_NAME,
} from "./render-state-sort.js";

export function sortRenderQueueRecords(
  records: RenderQueueRecord[],
): RenderQueueRecord[] {
  records.sort(compareRenderQueueRecords);
  return records;
}

export function compareRenderQueueRecords(
  a: RenderQueueRecord,
  b: RenderQueueRecord,
): number {
  return compareStateAwareRenderRecords(a, b) || a.sortOrdinal - b.sortOrdinal;
}

export function coalesceRenderQueueRecords(
  records: RenderQueueRecord[],
): RenderQueueRecord[] {
  if (records.length < 2) {
    return records;
  }

  let writeIndex = 1;

  for (let readIndex = 1; readIndex < records.length; readIndex += 1) {
    const previous = records[writeIndex - 1] as
      | MutableRenderQueueRecord
      | undefined;
    const record = records[readIndex];

    if (previous === undefined || record === undefined) {
      continue;
    }

    if (canCoalesceRenderQueueRecord(previous, record)) {
      previous.instanceCount += record.instanceCount;
      previous.drawKind = "instanced";
      previous.sourceRecordCount += record.sourceRecordCount;
      appendSources(previous, record);
      continue;
    }

    records[writeIndex] = record;
    writeIndex += 1;
  }

  records.length = writeIndex;
  return records;
}

export function batchStaticRenderQueueRecords(
  records: RenderQueueRecord[],
  options?: RenderQueueStaticBatchingOptions,
): RenderQueueRecord[] {
  if (!options?.enabled || records.length < 2) {
    return records;
  }

  const maxRecordsPerBatch = Math.max(
    1,
    Math.floor(options.maxRecordsPerBatch ?? 4),
  );
  let writeIndex = 1;

  for (let readIndex = 1; readIndex < records.length; readIndex += 1) {
    const previous = records[writeIndex - 1] as
      | MutableRenderQueueRecord
      | undefined;
    const record = records[readIndex];

    if (previous === undefined || record === undefined) {
      continue;
    }

    if (canBatchStaticRenderQueueRecord(previous, record, maxRecordsPerBatch)) {
      previous.drawKind = "static-merged";
      previous.sourceRecordCount += record.sourceRecordCount;
      appendSources(previous, record);
      continue;
    }

    records[writeIndex] = record;
    writeIndex += 1;
  }

  records.length = writeIndex;
  return records;
}

export function writeRenderQueueSortPhases(
  records: readonly RenderQueueRecord[],
  output: RenderQueueSortPhaseReport[],
  pool: RenderQueueSortPhaseReport[] = [],
): readonly RenderQueueSortPhaseReport[] {
  output.length = 0;

  let opaque = 0;
  let transparent = 0;

  for (const record of records) {
    if (record.queueKind === "transparent") {
      transparent += 1;
    } else {
      opaque += 1;
    }
  }

  if (opaque > 0) {
    const phase = sortPhaseAt(pool, output.length);

    phase.phase = "opaque";
    phase.recordCount = opaque;
    phase.sortPolicy = renderQueueSortPolicyForPhase("opaque");
    delete phase.durationUs;
    output.push(phase);
  }

  if (transparent > 0) {
    const phase = sortPhaseAt(pool, output.length);

    phase.phase = "transparent";
    phase.recordCount = transparent;
    phase.sortPolicy = renderQueueSortPolicyForPhase("transparent");
    delete phase.durationUs;
    output.push(phase);
  }

  return output;
}

export function renderQueueSortPolicyForPhase(
  phase: RenderQueueKind,
): RenderQueueSortPolicyReport {
  return phase === "transparent"
    ? TRANSPARENT_RENDER_QUEUE_SORT_POLICY
    : OPAQUE_RENDER_QUEUE_SORT_POLICY;
}

function canCoalesceRenderQueueRecord(
  previous: RenderQueueRecord,
  record: RenderQueueRecord,
): boolean {
  return (
    previous.queueKind !== "transparent" &&
    record.queueKind !== "transparent" &&
    previous.viewId === record.viewId &&
    previous.passId === record.passId &&
    previous.queueKind === record.queueKind &&
    previous.meshResourceKey === record.meshResourceKey &&
    previous.materialResourceKey === record.materialResourceKey &&
    previous.pipelineKey === record.pipelineKey &&
    previous.materialKey === record.materialKey &&
    previous.meshLayoutKey === record.meshLayoutKey &&
    batchKeysMatch(previous.batchKey, record.batchKey) &&
    drawRangesMatch(previous, record) &&
    previous.transformPackedOffset + previous.instanceCount * 16 ===
      record.transformPackedOffset
  );
}

function canBatchStaticRenderQueueRecord(
  previous: RenderQueueRecord,
  record: RenderQueueRecord,
  maxRecordsPerBatch: number,
): boolean {
  return (
    maxRecordsPerBatch > 1 &&
    previous.queueKind === "opaque" &&
    record.queueKind === "opaque" &&
    previous.drawKind !== "instanced" &&
    record.drawKind === "single" &&
    previous.instanceCount === 1 &&
    record.instanceCount === 1 &&
    previous.sourceRecordCount + record.sourceRecordCount <=
      maxRecordsPerBatch &&
    previous.viewId === record.viewId &&
    previous.passId === record.passId &&
    previous.meshResourceKey !== record.meshResourceKey &&
    previous.materialResourceKey === record.materialResourceKey &&
    previous.pipelineKey === record.pipelineKey &&
    previous.materialKey === record.materialKey &&
    previous.meshLayoutKey === record.meshLayoutKey &&
    batchKeysMatch(previous.batchKey, record.batchKey) &&
    !previous.batchKey.instanced &&
    !previous.batchKey.skinned &&
    !previous.batchKey.morphed
  );
}

function appendSources(
  previous: MutableRenderQueueRecord,
  record: RenderQueueRecord,
): void {
  for (const renderId of record.sourceRenderIds) {
    previous.sourceRenderIds.push(renderId);
  }

  for (const meshResourceKey of record.sourceMeshResourceKeys) {
    previous.sourceMeshResourceKeys.push(meshResourceKey);
  }
}

function batchKeysMatch(a: ReadyDrawBatchKey, b: ReadyDrawBatchKey): boolean {
  return (
    a.pipelineKey === b.pipelineKey &&
    a.materialKey === b.materialKey &&
    a.meshLayoutKey === b.meshLayoutKey &&
    a.topology === b.topology &&
    a.instanced === b.instanced &&
    a.skinned === b.skinned &&
    a.morphed === b.morphed
  );
}

function drawRangesMatch(
  a: Pick<
    RenderQueueRecord,
    | "submesh"
    | "materialSlot"
    | "vertexStart"
    | "vertexCount"
    | "indexStart"
    | "indexCount"
  >,
  b: Pick<
    RenderQueueRecord,
    | "submesh"
    | "materialSlot"
    | "vertexStart"
    | "vertexCount"
    | "indexStart"
    | "indexCount"
  >,
): boolean {
  return (
    a.submesh === b.submesh &&
    a.materialSlot === b.materialSlot &&
    a.vertexStart === b.vertexStart &&
    a.vertexCount === b.vertexCount &&
    a.indexStart === b.indexStart &&
    a.indexCount === b.indexCount
  );
}

function sortPhaseAt(
  pool: RenderQueueSortPhaseReport[],
  index: number,
): MutableRenderQueueSortPhaseReport {
  const existing = pool[index] as MutableRenderQueueSortPhaseReport | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const phase: MutableRenderQueueSortPhaseReport = {
    phase: "opaque",
    recordCount: 0,
    sortPolicy: renderQueueSortPolicyForPhase("opaque"),
  };

  pool.push(phase);
  return phase;
}

const OPAQUE_RENDER_QUEUE_SORT_POLICY: RenderQueueSortPolicyReport = {
  name: OPAQUE_STATE_SORT_POLICY_NAME,
  depthOrder: "front-to-back",
  primaryKeys: [
    "queue",
    "viewId",
    "layer",
    "order",
    "pipelineKey",
    "materialResourceKey",
    "meshLayoutKey",
    "meshResourceKey",
    "depth",
  ],
  tieBreakers: ["stableId", "renderId", "sortOrdinal"],
  totalOrder: true,
};

const TRANSPARENT_RENDER_QUEUE_SORT_POLICY: RenderQueueSortPolicyReport = {
  name: "transparent-order-back-to-front-stable",
  depthOrder: "back-to-front",
  primaryKeys: ["queue", "viewId", "layer", "order", "depth"],
  tieBreakers: [
    "stableId",
    "pipelineKey",
    "materialKey",
    "meshKey",
    "renderId",
    "sortOrdinal",
  ],
  totalOrder: true,
};
