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
}

export interface RenderQueuePlan {
  readonly records: readonly RenderQueueRecord[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PlanRenderQueueOptions {
  readonly scope?: Partial<RenderQueueScope>;
}

export interface RenderQueueScratch {
  readonly records: RenderQueueRecord[];
  readonly diagnostics: RenderDiagnostic[];
  readonly recordPool: RenderQueueRecord[];
  readonly plan: RenderQueuePlan;
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
}

export function planRenderQueueRecords(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  options?: PlanRenderQueueOptions,
): RenderQueuePlan {
  const scratch = createRenderQueueScratch();

  writeRenderQueueRecords(readiness, transforms, scratch, options);

  return { records: scratch.records, diagnostics: scratch.diagnostics };
}

export function createRenderQueueScratch(capacity = 0): RenderQueueScratch {
  const recordPool: RenderQueueRecord[] = [];
  const records: RenderQueueRecord[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  for (let i = 0; i < capacity; i += 1) {
    recordPool.push(createEmptyRecord());
  }

  return {
    records,
    diagnostics,
    recordPool,
    plan: { records, diagnostics },
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
  const queueKind = options?.scope?.queueKind ?? "opaque";

  scratch.records.length = 0;
  scratch.diagnostics.length = 0;

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
    record.queueKind = queueKind;
    record.packet = draw.packet;
    record.meshResourceKey = draw.meshResourceKey;
    record.materialResourceKey = draw.materialResourceKey;
    record.pipelineKey = draw.batchKey.pipelineKey;
    record.materialKey = draw.batchKey.materialKey;
    record.meshLayoutKey = draw.batchKey.meshLayoutKey;
    record.batchKey = draw.batchKey;
    record.sortKey = draw.packet.sortKey;
    record.transformPackedOffset = transformPackedOffset;
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
  };
}
