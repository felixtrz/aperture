import { vec3 as wgpuVec3, type Vec3Arg as WgpuVec3Arg } from "wgpu-matrix";

import { EPSILON } from "./constants.js";
import { vec3 } from "./constructors.js";
import { v3 } from "./scalars.js";
import type { Aabb, BoundingSphere, Ray, RayHit } from "./types.js";

export function intersectRayAabb(
  ray: Ray,
  aabb: Aabb,
  maxDistance = Number.POSITIVE_INFINITY,
): RayHit | null {
  let tmin = 0;
  let tmax = maxDistance;

  for (let axis = 0; axis < 3; axis += 1) {
    const origin = v3(ray.origin, axis);
    const direction = v3(ray.direction, axis);
    const min = v3(aabb.min, axis);
    const max = v3(aabb.max, axis);

    if (Math.abs(direction) <= EPSILON) {
      if (origin < min || origin > max) {
        return null;
      }
      continue;
    }

    const inverseDirection = 1 / direction;
    let near = (min - origin) * inverseDirection;
    let far = (max - origin) * inverseDirection;

    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }

    tmin = Math.max(tmin, near);
    tmax = Math.min(tmax, far);

    if (tmin > tmax) {
      return null;
    }
  }

  return rayHitAt(ray, tmin);
}

export function rayIntersectsAabb(
  ray: Ray,
  aabb: Aabb,
  maxDistance = Number.POSITIVE_INFINITY,
): boolean {
  return intersectRayAabb(ray, aabb, maxDistance) !== null;
}

export function intersectRaySphere(
  ray: Ray,
  sphere: BoundingSphere,
  maxDistance = Number.POSITIVE_INFINITY,
): RayHit | null {
  const offset = wgpuVec3.subtract(
    asWgpuVec3Arg(ray.origin),
    asWgpuVec3Arg(sphere.center),
  );
  const direction = asWgpuVec3Arg(ray.direction);
  const a = wgpuVec3.dot(direction, direction);

  if (a <= EPSILON) {
    return null;
  }

  const b = 2 * wgpuVec3.dot(offset, direction);
  const c = wgpuVec3.dot(offset, offset) - sphere.radius * sphere.radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const denominator = 2 * a;
  const first = (-b - sqrtDiscriminant) / denominator;
  const second = (-b + sqrtDiscriminant) / denominator;
  const distance = first >= 0 ? first : second;

  if (distance < 0 || distance > maxDistance) {
    return null;
  }

  return rayHitAt(ray, distance);
}

export function rayIntersectsSphere(
  ray: Ray,
  sphere: BoundingSphere,
  maxDistance = Number.POSITIVE_INFINITY,
): boolean {
  return intersectRaySphere(ray, sphere, maxDistance) !== null;
}

function rayHitAt(ray: Ray, distance: number): RayHit {
  return {
    distance,
    point: wgpuVec3.addScaled(
      asWgpuVec3Arg(ray.origin),
      asWgpuVec3Arg(ray.direction),
      distance,
      vec3(),
    ),
  };
}

function asWgpuVec3Arg(value: Ray["origin"]): WgpuVec3Arg {
  return value as WgpuVec3Arg;
}
