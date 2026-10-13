import type { MaterialQueueFamily, MaterialQueueItem } from "./material-queue-types.js";
import type { RenderQueue } from "./snapshot.js";
export declare const MATERIAL_QUEUE_PHASE_ORDER: readonly RenderQueue[];
export declare function sortMaterialQueueItems(items: MaterialQueueItem[]): MaterialQueueItem[];
export declare function materialQueueFamilyFromPipelineKey(pipelineKey: string): MaterialQueueFamily | null;
export declare function materialQueuePhaseRank(phase: RenderQueue): number;
export declare function compareStrings(a: string, b: string): number;
//# sourceMappingURL=material-queue-ordering.d.ts.map