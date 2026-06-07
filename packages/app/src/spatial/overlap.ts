import { transformPoint, type Vec3Like } from "@aperture-engine/simulation";

import { spatialEntryMatches } from "./filters.js";
import { entityRef } from "./math.js";
import { meshQueryTransforms } from "./mesh.js";
import type {
  SpatialOverlapHit,
  SpatialOverlapOptions,
  SpatialRaycastableMesh,
} from "./types.js";

/**
 * Entities whose BVH-backed mesh overlaps a world-space sphere.
 *
 * The sphere center is transformed into each mesh's local space and tested with
 * `MeshBvh.intersectsSphere`. The radius is used as-is, which is exact for rigid
 * mesh transforms (translation/rotation); non-uniform scale is not compensated.
 * Meshes without a BVH are skipped.
 */
export function overlapSphereOnMeshes(
  meshes: readonly SpatialRaycastableMesh[],
  center: Vec3Like,
  radius: number,
  options: SpatialOverlapOptions,
): readonly SpatialOverlapHit[] {
  const queryEntities = options.query?.entities;
  const hits: SpatialOverlapHit[] = [];

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

    const localCenter =
      transforms.meshFromWorld === undefined
        ? center
        : transformPoint(transforms.meshFromWorld, center);

    if (entry.bvh.intersectsSphere({ center: localCenter, radius })) {
      hits.push({
        entity: { entity: entry.entity, ref: entityRef(entry.entity) },
      });
    }
  }

  return hits;
}
