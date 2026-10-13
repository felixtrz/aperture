import { createMaterialQueueScratch } from "./material-queue-scratch.js";
import { writeMaterialQueueFromSnapshot } from "./material-queue.js";
export function buildMaterialQueueFromSnapshot(snapshot, resolvers) {
    const scratch = createMaterialQueueScratch();
    writeMaterialQueueFromSnapshot(snapshot, resolvers, scratch);
    return scratch.plan;
}
//# sourceMappingURL=material-queue-test-support.js.map