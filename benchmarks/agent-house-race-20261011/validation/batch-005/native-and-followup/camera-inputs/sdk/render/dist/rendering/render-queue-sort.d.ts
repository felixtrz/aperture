import { type RenderQueueRecord, type RenderQueueSortPhaseReport } from "./render-queue-types.js";
export { batchStaticRenderQueueRecords, coalesceRenderQueueRecords, } from "./render-queue-batching.js";
export { renderQueueSortPolicyForPhase } from "./render-queue-sort-policies.js";
export declare function sortRenderQueueRecords(records: RenderQueueRecord[]): RenderQueueRecord[];
export declare function compareRenderQueueRecords(a: RenderQueueRecord, b: RenderQueueRecord): number;
export declare function writeRenderQueueSortPhases(records: readonly RenderQueueRecord[], output: RenderQueueSortPhaseReport[], pool?: RenderQueueSortPhaseReport[]): readonly RenderQueueSortPhaseReport[];
//# sourceMappingURL=render-queue-sort.d.ts.map