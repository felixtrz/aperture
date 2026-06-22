import type { RenderSnapshot } from "./snapshot.js";
import { createMaterialQueueScratch } from "./material-queue-scratch.js";
import { writeMaterialQueueFromSnapshot } from "./material-queue.js";
import type {
  MaterialQueuePlan,
  MaterialQueueResourceKeyResolvers,
} from "./material-queue-types.js";

export function buildMaterialQueueFromSnapshot(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "diagnostics">,
  resolvers: MaterialQueueResourceKeyResolvers,
): MaterialQueuePlan {
  const scratch = createMaterialQueueScratch();

  writeMaterialQueueFromSnapshot(snapshot, resolvers, scratch);

  return scratch.plan;
}
