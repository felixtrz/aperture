import type { PreparedMaterialStore } from "../assets/preparation.js";
import type { MaterialQueueResourceKeyResolvers } from "./material-queue.js";

export function createPreparedMaterialQueueResourceKeyResolver(
  materials: PreparedMaterialStore,
): MaterialQueueResourceKeyResolvers["materialResourceKey"] {
  return (input) =>
    materials.get(input.draw.material)?.prepared.materialResourceKey ?? null;
}
