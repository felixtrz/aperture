import { raycast as raycastBounds } from "@aperture-engine/simulation";
import { spatialEntryMatches } from "./filters.js";
import { entityRef, tuple3 } from "./math.js";
import type {
  RayInput,
  SpatialRaycastHit,
  SpatialRaycastOptions,
  SpatialRaycastableBounds,
} from "./types.js";

export function raycastBoundsHit(
  bounds: readonly SpatialRaycastableBounds[],
  ray: RayInput,
  options: SpatialRaycastOptions,
): SpatialRaycastHit | null {
  return raycastBoundsHits(bounds, ray, options)[0] ?? null;
}

export function raycastBoundsHits(
  bounds: readonly SpatialRaycastableBounds[],
  ray: RayInput,
  options: SpatialRaycastOptions,
): readonly SpatialRaycastHit[] {
  const queryEntities = options.query?.entities;
  const candidates =
    queryEntities === undefined
      ? bounds
      : bounds.filter((candidate) => queryEntities.has(candidate.entity));
  const filteredCandidates = candidates.filter((candidate) =>
    spatialEntryMatches(candidate, candidate.entity, options, "bounds"),
  );
  return raycastBounds(filteredCandidates, ray.origin, ray.direction, {
    ...(options.maxDistance === undefined
      ? {}
      : { maxDistance: options.maxDistance }),
    ...(options.layerMask === undefined
      ? {}
      : { layerMask: options.layerMask }),
  }).map((boundsHit) => ({
    entity: {
      entity: boundsHit.entity,
      ref: entityRef(boundsHit.entity),
    },
    distance: boundsHit.distance,
    point: tuple3(boundsHit.point),
    source: "bounds",
  }));
}
