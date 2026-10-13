import type { RenderSnapshot } from "./snapshot.js";
import type { MaterialQueuePlan, MaterialQueueResourceKeyResolvers, MaterialQueueScratch } from "./material-queue-types.js";
export { createMaterialQueueScratch } from "./material-queue-scratch.js";
export { MATERIAL_QUEUE_PHASE_ORDER, compareStrings, materialQueueFamilyFromPipelineKey, materialQueuePhaseRank, sortMaterialQueueItems, } from "./material-queue-ordering.js";
export { createMaterialQueuePhaseSummary } from "./material-queue-summary.js";
export type { MaterialQueueFamily, MaterialQueueFamilyBucketSummary, MaterialQueueItem, MaterialQueueItemSortKey, MaterialQueuePhaseBucketSummary, MaterialQueuePhaseFamilyBucketSummary, MaterialQueuePhaseSummary, MaterialQueuePlan, MaterialQueueResolverInput, MaterialQueueResourceKeyResolvers, MaterialQueueScratch, } from "./material-queue-types.js";
export declare function writeMaterialQueueFromSnapshot(snapshot: Pick<RenderSnapshot, "meshDraws" | "diagnostics">, resolvers: MaterialQueueResourceKeyResolvers, scratch: MaterialQueueScratch): MaterialQueuePlan;
//# sourceMappingURL=material-queue.d.ts.map