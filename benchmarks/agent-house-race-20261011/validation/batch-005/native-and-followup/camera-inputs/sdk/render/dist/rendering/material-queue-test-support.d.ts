import type { RenderSnapshot } from "./snapshot.js";
import type { MaterialQueuePlan, MaterialQueueResourceKeyResolvers } from "./material-queue-types.js";
export declare function buildMaterialQueueFromSnapshot(snapshot: Pick<RenderSnapshot, "meshDraws" | "diagnostics">, resolvers: MaterialQueueResourceKeyResolvers): MaterialQueuePlan;
//# sourceMappingURL=material-queue-test-support.d.ts.map