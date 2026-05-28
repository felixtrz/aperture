import type {
  RenderWorldDrawReadinessReport,
  RenderWorldReadyDraw,
} from "./render-world.js";
import type { RenderDiagnostic } from "./snapshot.js";
import type { OPAQUE_STATE_SORT_POLICY_NAME } from "./render-state-sort.js";

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
  readonly sortOrdinal: number;
  readonly viewId: string;
  readonly passId: string;
  readonly queueKind: RenderQueueKind;
  readonly packet: RenderWorldReadyDraw["packet"];
  readonly submesh: number;
  readonly materialSlot: number;
  readonly vertexStart?: number;
  readonly vertexCount?: number;
  readonly indexStart?: number;
  readonly indexCount?: number;
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
  readonly sortPolicy: RenderQueueSortPolicyReport;
  readonly durationUs?: number;
}

export type RenderQueueSortPolicyName =
  | typeof OPAQUE_STATE_SORT_POLICY_NAME
  | "transparent-order-back-to-front-stable";

export type RenderQueueDepthOrder = "front-to-back" | "back-to-front";

export interface RenderQueueSortPolicyReport {
  readonly name: RenderQueueSortPolicyName;
  readonly depthOrder: RenderQueueDepthOrder;
  readonly primaryKeys: readonly string[];
  readonly tieBreakers: readonly string[];
  readonly totalOrder: true;
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

export interface MutableRenderQueueSortPhaseReport {
  phase: RenderQueueKind;
  recordCount: number;
  sortPolicy: RenderQueueSortPolicyReport;
  durationUs?: number;
}

export interface MutableRenderQueueRecord {
  renderId: number;
  sortOrdinal: number;
  viewId: string;
  passId: string;
  queueKind: RenderQueueKind;
  packet: RenderWorldReadyDraw["packet"];
  submesh: number;
  materialSlot: number;
  vertexStart?: number;
  vertexCount?: number;
  indexStart?: number;
  indexCount?: number;
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

export type ReadyDrawPacket = RenderWorldReadyDraw["packet"];
export type ReadyDrawBatchKey = RenderWorldReadyDraw["batchKey"];
export type DrawReadinessReport = RenderWorldDrawReadinessReport;
