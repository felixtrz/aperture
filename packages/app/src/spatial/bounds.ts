import { raycast as raycastBounds } from "@aperture-engine/simulation";
import type { Entity } from "@aperture-engine/simulation";
import { spatialEntryMatches } from "./filters.js";
import { entityRef, tuple3 } from "./math.js";
import type {
  RayInput,
  SpatialPickableState,
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

  const pickableByEntity = new Map<Entity, SpatialPickableState | undefined>();
  for (const candidate of filteredCandidates) {
    pickableByEntity.set(candidate.entity, candidate.pickable);
  }

  const rawHits = raycastBounds(filteredCandidates, ray.origin, ray.direction, {
    ...(options.maxDistance === undefined
      ? {}
      : { maxDistance: options.maxDistance }),
    ...(options.layerMask === undefined
      ? {}
      : { layerMask: options.layerMask }),
  });

  return applyPickablePolicy(rawHits, pickableByEntity).map((boundsHit) => ({
    entity: {
      entity: boundsHit.entity,
      ref: entityRef(boundsHit.entity),
    },
    distance: boundsHit.distance,
    point: tuple3(boundsHit.point),
    source: "bounds",
  }));
}

/**
 * Apply the authoring-facing Pickable.blocksLower + Pickable.priority semantics to
 * the distance-sorted bounds hits. With the defaults (blocksLower=false, priority=0)
 * this is a no-op and the geometric distance ordering is preserved.
 */
function applyPickablePolicy<
  THit extends { readonly entity: Entity; readonly distance: number },
>(
  hits: readonly THit[],
  pickableByEntity: ReadonlyMap<Entity, SpatialPickableState | undefined>,
): readonly THit[] {
  // blocksLower: the nearest blocking hit suppresses everything farther behind it.
  let cutoff = Number.POSITIVE_INFINITY;
  for (const hit of hits) {
    if (pickableByEntity.get(hit.entity)?.blocksLower === true) {
      cutoff = hit.distance;
      break;
    }
  }
  const visible =
    cutoff === Number.POSITIVE_INFINITY
      ? hits
      : hits.filter((hit) => hit.distance <= cutoff);

  // priority: a higher priority wins even when geometrically farther; a stable sort
  // keeps the distance order within a priority band (so priority=0 == distance order).
  return visible
    .map((hit, index) => ({
      hit,
      index,
      priority: pickableByEntity.get(hit.entity)?.priority ?? 0,
    }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map((entry) => entry.hit);
}
