import { EPSILON } from "./math/constants.js";
import { vec3 } from "./math/constructors.js";
import { intersectRayAabb, intersectRaySphere } from "./math/ray.js";
import { v3 } from "./math/scalars.js";
import type {
  Aabb,
  BoundingSphere,
  Ray,
  RayHit,
  Vec3Like,
} from "./math/types.js";

const DEFAULT_RAY_LAYER_MASK = 0xffffffff;
const DEFAULT_OBJECT_LAYER_MASK = 0x00000001;

export interface RaycastableBounds<TEntity = unknown> {
  readonly entity: TEntity;
  readonly worldAabb: Aabb;
  readonly worldSphere?: BoundingSphere;
  readonly layerMask?: number;
}

export interface RaycastWorld<TEntity = unknown> {
  readonly bounds: readonly RaycastableBounds<TEntity>[];
}

export interface RaycastOptions {
  readonly maxDistance?: number;
  readonly layerMask?: number;
}

export interface RaycastHit<TEntity = unknown> extends RayHit {
  readonly entity: TEntity;
  readonly bounds: RaycastableBounds<TEntity>;
}

interface IndexedRaycastHit<TEntity> extends RaycastHit<TEntity> {
  readonly sourceIndex: number;
}

export function raycast<TEntity>(
  world: RaycastWorld<TEntity> | readonly RaycastableBounds<TEntity>[],
  origin: Vec3Like,
  direction: Vec3Like,
  options: RaycastOptions = {},
): RaycastHit<TEntity>[] {
  const ray = createNormalizedRay(origin, direction);
  const maxDistance = normalizeMaxDistance(options.maxDistance);

  if (ray === null || maxDistance === null) {
    return [];
  }

  const filterLayerMask = toLayerMask(
    options.layerMask,
    DEFAULT_RAY_LAYER_MASK,
  );
  const bounds = isRaycastBoundsArray(world) ? world : world.bounds;
  const hits: IndexedRaycastHit<TEntity>[] = [];

  for (let sourceIndex = 0; sourceIndex < bounds.length; sourceIndex += 1) {
    const candidate = bounds[sourceIndex];

    if (candidate === undefined) {
      continue;
    }

    const candidateLayerMask = toLayerMask(
      candidate.layerMask,
      DEFAULT_OBJECT_LAYER_MASK,
    );

    if ((candidateLayerMask & filterLayerMask) === 0) {
      continue;
    }

    if (
      candidate.worldSphere !== undefined &&
      intersectRaySphere(ray, candidate.worldSphere, maxDistance) === null
    ) {
      continue;
    }

    const hit = intersectRayAabb(ray, candidate.worldAabb, maxDistance);

    if (hit === null) {
      continue;
    }

    hits.push({
      sourceIndex,
      entity: candidate.entity,
      bounds: candidate,
      distance: hit.distance,
      point: hit.point,
    });
  }

  return hits
    .sort((a, b) => a.distance - b.distance || a.sourceIndex - b.sourceIndex)
    .map(({ sourceIndex: _sourceIndex, ...hit }) => hit);
}

function createNormalizedRay(
  origin: Vec3Like,
  direction: Vec3Like,
): Ray | null {
  const ox = v3(origin, 0);
  const oy = v3(origin, 1);
  const oz = v3(origin, 2);
  const dx = v3(direction, 0);
  const dy = v3(direction, 1);
  const dz = v3(direction, 2);
  const directionLength = Math.hypot(dx, dy, dz);

  if (
    !Number.isFinite(ox) ||
    !Number.isFinite(oy) ||
    !Number.isFinite(oz) ||
    !Number.isFinite(directionLength) ||
    directionLength <= EPSILON
  ) {
    return null;
  }

  return {
    origin: vec3(ox, oy, oz),
    direction: vec3(
      dx / directionLength,
      dy / directionLength,
      dz / directionLength,
    ),
  };
}

function normalizeMaxDistance(value: number | undefined): number | null {
  if (value === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function toLayerMask(value: number | undefined, fallback: number): number {
  return (value ?? fallback) >>> 0;
}

function isRaycastBoundsArray<TEntity>(
  world: RaycastWorld<TEntity> | readonly RaycastableBounds<TEntity>[],
): world is readonly RaycastableBounds<TEntity>[] {
  return Array.isArray(world);
}
