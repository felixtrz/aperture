import type { PreparedMeshStore } from "../assets/preparation.js";
import type { MaterialQueueResourceKeyResolvers } from "./material-queue.js";

export function createPreparedMeshQueueResourceKeyResolver(
  meshes: PreparedMeshStore,
): MaterialQueueResourceKeyResolvers["meshResourceKey"] {
  return (input) =>
    meshes.get(input.draw.mesh)?.prepared.meshResourceKey ?? null;
}
