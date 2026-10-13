import { transformPoint, type Vec3Like } from "@aperture-engine/simulation";

import { spatialEntryMatches } from "./filters.js";
import { distanceBetween, entityRef, tuple3 } from "./math.js";
import { meshQueryTransforms } from "./mesh.js";
import type {
  SpatialClosestPointHit,
  SpatialClosestPointOptions,
  SpatialRaycastableMesh,
} from "./types.js";

export interface SpatialMeshClosestPointResult {
  readonly hit: SpatialClosestPointHit | null;
  readonly queryableMeshCount: number;
}

/**
 * Closest point on any BVH-backed registered mesh to a world-space point.
 *
 * The query point is transformed into each mesh's local space, resolved against
 * its BVH, and the resulting surface point transformed back to world space; the
 * winner is chosen by world-space distance (so meshes with different transforms
 * are compared consistently). `maxDistance` is applied as a world-space filter.
 * Meshes without a BVH are skipped (there is no triangle-scan closest-point
 * fallback today).
 */
export function closestPointOnMeshes(
  meshes: readonly SpatialRaycastableMesh[],
  point: Vec3Like,
  options: SpatialClosestPointOptions,
): SpatialMeshClosestPointResult {
  const queryEntities = options.query?.entities;
  let closest: SpatialClosestPointHit | null = null;
  let queryableMeshCount = 0;

  for (const entry of meshes) {
    if (entry.bvh === undefined) {
      continue;
    }

    if (queryEntities !== undefined && !queryEntities.has(entry.entity)) {
      continue;
    }

    if (!spatialEntryMatches(entry, entry.entity, options, "mesh")) {
      continue;
    }

    const transforms = meshQueryTransforms(entry);

    if (transforms === null) {
      continue;
    }

    queryableMeshCount += 1;

    const localPoint =
      transforms.meshFromWorld === undefined
        ? point
        : transformPoint(transforms.meshFromWorld, point);
    const localResult = entry.bvh.closestPointToPoint(localPoint);

    if (localResult === null) {
      continue;
    }

    const worldPoint =
      transforms.worldFromMesh === undefined
        ? tuple3(localResult.point)
        : tuple3(transformPoint(transforms.worldFromMesh, localResult.point));
    const distance = distanceBetween(point, worldPoint);

    if (options.maxDistance !== undefined && distance > options.maxDistance) {
      continue;
    }

    if (closest === null || distance < closest.distance) {
      closest = {
        entity: { entity: entry.entity, ref: entityRef(entry.entity) },
        point: worldPoint,
        distance,
        faceIndex: localResult.faceIndex,
        submeshIndex: localResult.submeshIndex,
        materialSlot: localResult.materialSlot,
      };
    }
  }

  return { hit: closest, queryableMeshCount };
}
