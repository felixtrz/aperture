import {
  transformPoint,
  type Mat4Like,
  type MeshBvh,
  type Vec3Like,
} from "@aperture-engine/simulation";

import { spatialEntryMatches } from "./filters.js";
import { entityRef } from "./math.js";
import { meshQueryTransforms } from "./mesh.js";
import type {
  SpatialOverlapHit,
  SpatialOverlapOptions,
  SpatialRaycastableMesh,
} from "./types.js";

interface MeshOverlapTransforms {
  readonly meshFromWorld?: Mat4Like;
  readonly worldFromMesh?: Mat4Like;
}

/**
 * Iterate the BVH-backed, filter-passing meshes and collect the entities for
 * which `test` reports an overlap. `test` receives the mesh's BVH and its
 * world<->mesh transforms so each shape query can localize itself.
 */
function collectOverlaps(
  meshes: readonly SpatialRaycastableMesh[],
  options: SpatialOverlapOptions,
  test: (bvh: MeshBvh, transforms: MeshOverlapTransforms) => boolean,
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

    if (test(entry.bvh, transforms)) {
      hits.push({
        entity: { entity: entry.entity, ref: entityRef(entry.entity) },
      });
    }
  }

  return hits;
}

function toMeshSpace(
  point: Vec3Like,
  meshFromWorld: Mat4Like | undefined,
): Vec3Like {
  return meshFromWorld === undefined
    ? point
    : transformPoint(meshFromWorld, point);
}

/** Entities whose BVH-backed mesh overlaps a world-space sphere. */
export function overlapSphereOnMeshes(
  meshes: readonly SpatialRaycastableMesh[],
  center: Vec3Like,
  radius: number,
  options: SpatialOverlapOptions,
): readonly SpatialOverlapHit[] {
  return collectOverlaps(meshes, options, (bvh, transforms) =>
    bvh.intersectsSphere({
      center: toMeshSpace(center, transforms.meshFromWorld),
      radius,
    }),
  );
}

/**
 * Entities whose BVH-backed mesh overlaps a world-space AABB. The box is handed
 * to the BVH with the mesh-from-world transform so it is localized exactly
 * (including rotation) rather than treated as axis-aligned in mesh space.
 */
export function overlapBoxOnMeshes(
  meshes: readonly SpatialRaycastableMesh[],
  min: Vec3Like,
  max: Vec3Like,
  options: SpatialOverlapOptions,
): readonly SpatialOverlapHit[] {
  return collectOverlaps(meshes, options, (bvh, transforms) =>
    bvh.intersectsBox({ min, max }, transforms.meshFromWorld),
  );
}

/**
 * Entities whose BVH-backed mesh overlaps a world-space capsule. The segment
 * endpoints are transformed into mesh space; the radius is world-space (exact
 * for rigid mesh transforms).
 */
export function overlapCapsuleOnMeshes(
  meshes: readonly SpatialRaycastableMesh[],
  start: Vec3Like,
  end: Vec3Like,
  radius: number,
  options: SpatialOverlapOptions,
): readonly SpatialOverlapHit[] {
  return collectOverlaps(meshes, options, (bvh, transforms) =>
    bvh.intersectsCapsule({
      start: toMeshSpace(start, transforms.meshFromWorld),
      end: toMeshSpace(end, transforms.meshFromWorld),
      radius,
    }),
  );
}
