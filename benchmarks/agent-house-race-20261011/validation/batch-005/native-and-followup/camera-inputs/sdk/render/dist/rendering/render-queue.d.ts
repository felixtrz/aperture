import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { PackedSnapshotTransforms } from "./transform-pack.js";
import { type PlanRenderQueueOptions, type RenderQueuePlan, type RenderQueueScratch } from "./render-queue-types.js";
export { DEFAULT_RENDER_QUEUE_PASS_ID, DEFAULT_RENDER_QUEUE_VIEW_ID, type PlanRenderQueueOptions, type RenderQueueDepthOrder, type RenderQueueKind, type RenderQueuePlan, type RenderQueueRecord, type RenderQueueScope, type RenderQueueScratch, type RenderQueueSortPhaseReport, type RenderQueueSortPolicyName, type RenderQueueSortPolicyReport, type RenderQueueStaticBatchingOptions, } from "./render-queue-types.js";
export { createRenderQueueScratch } from "./render-queue-scratch.js";
export { batchStaticRenderQueueRecords, coalesceRenderQueueRecords, compareRenderQueueRecords, renderQueueSortPolicyForPhase, sortRenderQueueRecords, writeRenderQueueSortPhases, } from "./render-queue-sort.js";
export declare function planRenderQueueRecords(readiness: RenderWorldDrawReadinessReport, transforms: PackedSnapshotTransforms, options?: PlanRenderQueueOptions): RenderQueuePlan;
export declare function writeRenderQueueRecords(readiness: RenderWorldDrawReadinessReport, transforms: PackedSnapshotTransforms, scratch: RenderQueueScratch, options?: PlanRenderQueueOptions): RenderQueuePlan;
export declare function writeUnsortedRenderQueueRecords(readiness: RenderWorldDrawReadinessReport, transforms: PackedSnapshotTransforms, scratch: RenderQueueScratch, options?: PlanRenderQueueOptions): RenderQueuePlan;
//# sourceMappingURL=render-queue.d.ts.map