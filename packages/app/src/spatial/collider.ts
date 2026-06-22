import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type {
  PhysicsBackend,
  PhysicsQueryOptions,
  PhysicsRaycastHit,
} from "@aperture-engine/physics";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { entityRef, tuple3 } from "./math.js";
import type {
  RayInput,
  SpatialRaycastHit,
  SpatialRaycastOptions,
} from "./types.js";

export interface SpatialColliderQueries {
  readonly world: EcsWorld;
  getPhysicsBackend(): PhysicsBackend | null;
}

export function raycastColliderHit(
  colliderQueries: SpatialColliderQueries | undefined,
  ray: RayInput,
  options: SpatialRaycastOptions,
): SpatialRaycastHit | null {
  return raycastColliderHits(colliderQueries, ray, options)[0] ?? null;
}

export function raycastColliderHits(
  colliderQueries: SpatialColliderQueries | undefined,
  ray: RayInput,
  options: SpatialRaycastOptions,
): readonly SpatialRaycastHit[] {
  const backend = colliderQueries?.getPhysicsBackend() ?? null;

  if (colliderQueries === undefined || backend === null) {
    return [];
  }

  const queryEntities = options.query?.entities;
  const hits: SpatialRaycastHit[] = [];

  for (const hit of backend.raycastAll(
    {
      origin: tuple3(ray.origin),
      direction: tuple3(ray.direction),
      ...(options.maxDistance === undefined
        ? {}
        : { maxDistance: options.maxDistance }),
    },
    physicsQueryOptions(options),
  )) {
    const entity = entityFromPhysicsHit(colliderQueries.world, hit);

    if (entity === null) {
      continue;
    }

    if (queryEntities !== undefined && !queryEntities.has(entity)) {
      continue;
    }

    if (options.filter?.(entity) === false) {
      continue;
    }

    hits.push(spatialHitFromPhysicsHit(entity, hit));
  }

  return hits.sort(compareSpatialColliderHits);
}

function entityFromPhysicsHit(
  world: EcsWorld,
  hit: PhysicsRaycastHit,
): Entity | null {
  const ref = parsePhysicsEntityRef(hit.entity);

  if (ref === null) {
    return null;
  }

  const resolved = resolveActiveEntity(world, ref);

  return resolved.ok ? resolved.entity : null;
}

function spatialHitFromPhysicsHit(
  entity: Entity,
  hit: PhysicsRaycastHit,
): SpatialRaycastHit {
  return {
    entity: {
      entity,
      ref: entityRef(entity),
    },
    distance: hit.distance,
    point: tuple3(hit.point),
    normal: tuple3(hit.normal),
    source: "collider",
  };
}

function physicsQueryOptions(
  options: SpatialRaycastOptions,
): PhysicsQueryOptions {
  return {
    ...(options.layerMask === undefined
      ? {}
      : { collisionGroups: options.layerMask }),
    ...(options.includeSensors === undefined
      ? {}
      : { includeSensors: options.includeSensors }),
  };
}

function parsePhysicsEntityRef(ref: string): EcsEntityRef | null {
  const separator = ref.indexOf(":");

  if (separator <= 0 || separator !== ref.lastIndexOf(":")) {
    return null;
  }

  const index = Number.parseInt(ref.slice(0, separator), 10);
  const generation = Number.parseInt(ref.slice(separator + 1), 10);

  if (!Number.isInteger(index) || !Number.isInteger(generation)) {
    return null;
  }

  return { index, generation };
}

function compareSpatialColliderHits(
  a: SpatialRaycastHit,
  b: SpatialRaycastHit,
): number {
  return (
    a.distance - b.distance ||
    a.entity.ref.index - b.entity.ref.index ||
    a.entity.ref.generation - b.entity.ref.generation
  );
}
