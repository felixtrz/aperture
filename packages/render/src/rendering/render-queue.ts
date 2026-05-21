import type {
  RenderWorldDrawReadinessReport,
  RenderWorldReadyDraw,
} from "./render-world.js";
import type { RenderDiagnostic } from "./snapshot.js";
import { compareRenderSortKeys } from "./snapshot.js";
import type { PackedSnapshotTransforms } from "./transform-pack.js";

export const DEFAULT_RENDER_QUEUE_VIEW_ID = "default";
export const DEFAULT_RENDER_QUEUE_PASS_ID = "main";

export type RenderQueueKind = "opaque" | "transparent";

export interface RenderQueueScope {
  readonly viewId: string;
  readonly passId: string;
  readonly queueKind: RenderQueueKind;
}

export interface RenderQueueRecord {
  readonly renderId: number;
  readonly viewId: string;
  readonly passId: string;
  readonly queueKind: RenderQueueKind;
  readonly packet: RenderWorldReadyDraw["packet"];
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly pipelineKey: string;
  readonly materialKey: string;
  readonly meshLayoutKey: string;
  readonly batchKey: RenderWorldReadyDraw["batchKey"];
  readonly sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
  readonly transformPackedOffset: number;
  readonly instanceCount: number;
  readonly drawKind: "single" | "instanced" | "static-merged";
  readonly sourceRecordCount: number;
  readonly sourceRenderIds: readonly number[];
  readonly sourceMeshResourceKeys: readonly string[];
}

export interface RenderQueueSortPhaseReport {
  readonly phase: RenderQueueKind;
  readonly recordCount: number;
  readonly durationUs?: number;
}

export interface RenderQueuePlan {
  readonly records: readonly RenderQueueRecord[];
  readonly diagnostics: readonly RenderDiagnostic[];
  readonly sortPhases: readonly RenderQueueSortPhaseReport[];
}

export interface PlanRenderQueueOptions {
  readonly scope?: Partial<RenderQueueScope>;
  readonly staticBatching?: RenderQueueStaticBatchingOptions;
}

export interface RenderQueueStaticBatchingOptions {
  readonly enabled?: boolean;
  readonly maxRecordsPerBatch?: number;
}

export interface RenderQueueScratch {
  readonly records: RenderQueueRecord[];
  readonly diagnostics: RenderDiagnostic[];
  readonly sortPhases: RenderQueueSortPhaseReport[];
  readonly sortPhasePool: RenderQueueSortPhaseReport[];
  readonly recordPool: RenderQueueRecord[];
  readonly plan: RenderQueuePlan;
}

interface MutableRenderQueueSortPhaseReport {
  phase: RenderQueueKind;
  recordCount: number;
  durationUs?: number;
}

interface MutableRenderQueueRecord {
  renderId: number;
  viewId: string;
  passId: string;
  queueKind: RenderQueueKind;
  packet: RenderWorldReadyDraw["packet"];
  meshResourceKey: string;
  materialResourceKey: string;
  pipelineKey: string;
  materialKey: string;
  meshLayoutKey: string;
  batchKey: RenderWorldReadyDraw["batchKey"];
  sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
  transformPackedOffset: number;
  instanceCount: number;
  drawKind: "single" | "instanced" | "static-merged";
  sourceRecordCount: number;
  readonly sourceRenderIds: number[];
  readonly sourceMeshResourceKeys: string[];
}

export function planRenderQueueRecords(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  options?: PlanRenderQueueOptions,
): RenderQueuePlan {
  const scratch = createRenderQueueScratch();

  writeRenderQueueRecords(readiness, transforms, scratch, options);

  return scratch.plan;
}

export function createRenderQueueScratch(capacity = 0): RenderQueueScratch {
  const recordPool: RenderQueueRecord[] = [];
  const records: RenderQueueRecord[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const sortPhases: RenderQueueSortPhaseReport[] = [];
  const sortPhasePool: RenderQueueSortPhaseReport[] = [
    { phase: "opaque", recordCount: 0 },
    { phase: "transparent", recordCount: 0 },
  ];

  for (let i = 0; i < capacity; i += 1) {
    recordPool.push(createEmptyRecord());
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

export function writeRenderQueueRecords(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  scratch: RenderQueueScratch,
  options?: PlanRenderQueueOptions,
): RenderQueuePlan {
  writeUnsortedRenderQueueRecords(readiness, transforms, scratch, options);
  sortRenderQueueRecords(scratch.records);
  coalesceRenderQueueRecords(scratch.records);
  batchStaticRenderQueueRecords(scratch.records, options?.staticBatching);
  writeRenderQueueSortPhases(
    scratch.records,
    scratch.sortPhases,
    scratch.sortPhasePool,
  );

  return scratch.plan;
}

export function writeUnsortedRenderQueueRecords(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  scratch: RenderQueueScratch,
  options?: PlanRenderQueueOptions,
): RenderQueuePlan {
  const viewId = options?.scope?.viewId ?? DEFAULT_RENDER_QUEUE_VIEW_ID;
  const passId = options?.scope?.passId ?? DEFAULT_RENDER_QUEUE_PASS_ID;
  const queueKindOverride = options?.scope?.queueKind;

  scratch.records.length = 0;
  scratch.diagnostics.length = 0;
  scratch.sortPhases.length = 0;

  for (const diagnostic of transforms.diagnostics) {
    scratch.diagnostics.push(diagnostic);
  }

  for (const blocked of readiness.blocked) {
    scratch.diagnostics.push({
      code: "renderDrawPackage.blockedDraw",
      message: `Render object ${blocked.renderId} is blocked by missing resources: ${blocked.missing.join(", ")}.`,
      severity: "warning",
      entity: blocked.packet.entity,
    });
  }

  for (const draw of readiness.ready) {
    const transformPackedOffset = findPackedTransformOffset(
      transforms,
      draw.renderId,
    );

    if (transformPackedOffset === undefined) {
      scratch.diagnostics.push({
        code: "renderDrawPackage.missingPackedTransform",
        message: `Render object ${draw.renderId} is ready but has no packed transform offset.`,
        severity: "warning",
        entity: draw.packet.entity,
      });
      continue;
    }

    const record = recordAt(scratch, scratch.records.length);

    record.renderId = draw.renderId;
    record.viewId = viewId;
    record.passId = passId;
    record.queueKind =
      queueKindOverride ?? renderQueueKindFromSortKey(draw.packet.sortKey);
    record.packet = draw.packet;
    record.meshResourceKey = draw.meshResourceKey;
    record.materialResourceKey = draw.materialResourceKey;
    record.pipelineKey = draw.batchKey.pipelineKey;
    record.materialKey = draw.batchKey.materialKey;
    record.meshLayoutKey = draw.batchKey.meshLayoutKey;
    record.batchKey = draw.batchKey;
    record.sortKey = draw.packet.sortKey;
    record.transformPackedOffset = transformPackedOffset;
    record.instanceCount = 1;
    record.drawKind = "single";
    record.sourceRecordCount = 1;
    record.sourceRenderIds.length = 0;
    record.sourceRenderIds.push(draw.renderId);
    record.sourceMeshResourceKeys.length = 0;
    record.sourceMeshResourceKeys.push(draw.meshResourceKey);
    scratch.records.push(record);
  }

  return scratch.plan;
}

export function sortRenderQueueRecords(
  records: RenderQueueRecord[],
): RenderQueueRecord[] {
  records.sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  return records;
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
    delete phase.durationUs;
    output.push(phase);
  }

  if (transparent > 0) {
    const phase = sortPhaseAt(pool, output.length);

    phase.phase = "transparent";
    phase.recordCount = transparent;
    delete phase.durationUs;
    output.push(phase);
  }

  return output;
}

function findPackedTransformOffset(
  transforms: PackedSnapshotTransforms,
  renderId: number,
): number | undefined {
  for (const offset of transforms.offsets) {
    if (offset.renderId === renderId) {
      return offset.packedOffset;
    }
  }

  return undefined;
}

function renderQueueKindFromSortKey(
  sortKey: RenderWorldReadyDraw["packet"]["sortKey"],
): RenderQueueKind {
  return sortKey.queue === "transparent" ? "transparent" : "opaque";
}

function canCoalesceRenderQueueRecord(
  previous: RenderQueueRecord,
  record: RenderQueueRecord,
): boolean {
  return (
    previous.viewId === record.viewId &&
    previous.passId === record.passId &&
    previous.queueKind === record.queueKind &&
    previous.meshResourceKey === record.meshResourceKey &&
    previous.materialResourceKey === record.materialResourceKey &&
    previous.pipelineKey === record.pipelineKey &&
    previous.materialKey === record.materialKey &&
    previous.meshLayoutKey === record.meshLayoutKey &&
    batchKeysMatch(previous.batchKey, record.batchKey) &&
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

function batchKeysMatch(
  a: RenderWorldReadyDraw["batchKey"],
  b: RenderWorldReadyDraw["batchKey"],
): boolean {
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

function recordAt(
  scratch: RenderQueueScratch,
  index: number,
): MutableRenderQueueRecord {
  const existing = scratch.recordPool[index] as
    | MutableRenderQueueRecord
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const record = createEmptyRecord();

  scratch.recordPool.push(record);
  return record;
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
  };

  pool.push(phase);
  return phase;
}

function createEmptyRecord(): MutableRenderQueueRecord {
  return {
    renderId: 0,
    viewId: DEFAULT_RENDER_QUEUE_VIEW_ID,
    passId: DEFAULT_RENDER_QUEUE_PASS_ID,
    queueKind: "opaque",
    packet: null as unknown as RenderWorldReadyDraw["packet"],
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
