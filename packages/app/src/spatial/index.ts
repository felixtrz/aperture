import { raycastBoundsHit, raycastBoundsHits } from "./bounds.js";
import { raycastMeshHit, raycastMeshHits } from "./mesh.js";
import type {
  SpatialQueries,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "./types.js";

export type {
  RayInput,
  SpatialPickableState,
  SpatialQueries,
  SpatialRaycastHit,
  SpatialRaycastOptions,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "./types.js";

export function createSpatialQueries(): SpatialQueries {
  let bounds: readonly SpatialRaycastableBounds[] = [];
  let meshes: readonly SpatialRaycastableMesh[] = [];

  return {
    raycastFirst(ray, options = {}) {
      const source = options.source ?? "bounds";

      if (source === "bounds") {
        return raycastBoundsHit(bounds, ray, options);
      }

      if (source === "collider") {
        return options.fallback === "bounds"
          ? raycastBoundsHit(bounds, ray, options)
          : null;
      }

      const meshResult = raycastMeshHit(meshes, ray, options);

      if (meshResult.hit !== null || options.fallback !== "bounds") {
        return meshResult.hit;
      }

      return meshResult.queryableMeshCount === 0
        ? raycastBoundsHit(bounds, ray, options)
        : null;
    },
    raycastAll(ray, options = {}) {
      const source = options.source ?? "bounds";

      if (source === "bounds") {
        return raycastBoundsHits(bounds, ray, options);
      }

      if (source === "collider") {
        return options.fallback === "bounds"
          ? raycastBoundsHits(bounds, ray, options)
          : [];
      }

      const meshResult = raycastMeshHits(meshes, ray, options);

      if (meshResult.hits.length > 0 || options.fallback !== "bounds") {
        return meshResult.hits;
      }

      return meshResult.queryableMeshCount === 0
        ? raycastBoundsHits(bounds, ray, options)
        : [];
    },
    setBounds(nextBounds) {
      bounds = [...nextBounds];
    },
    setMeshes(nextMeshes) {
      meshes = [...nextMeshes];
    },
  };
}
