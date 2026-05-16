import { describe, expect, it } from "vitest";
import { vec3 as wgpuVec3 } from "wgpu-matrix";

import {
  composeTrsMatrix,
  intersectRayAabb,
  intersectRaySphere,
  rayIntersectsAabb,
  rayIntersectsSphere,
  transformAabb,
  unionAabb,
  type Aabb,
  type BoundingSphere,
  type Ray,
  type Vec3Like,
} from "@aperture-engine/core";

const CLOSE_TO = 5;

describe("Aperture bounds and ray math", () => {
  it("unions and transforms AABBs", () => {
    const first: Aabb = { min: [0, 0, 0], max: [1, 1, 1] };
    const second: Aabb = { min: [-2, 0.5, 2], max: [0.5, 2, 3] };

    const union = unionAabb(first, second);
    expectVec3(union.min, [-2, 0, 0]);
    expectVec3(union.max, [1, 2, 3]);
    expectVec3(union.min, wgpuVec3.min(first.min, second.min));
    expectVec3(union.max, wgpuVec3.max(first.max, second.max));

    const transformed = transformAabb(
      first,
      composeTrsMatrix([1, 2, 3], [0, 0, 0, 1], [2, 3, 4]),
    );
    expectVec3(transformed.min, [1, 2, 3]);
    expectVec3(transformed.max, [3, 5, 7]);
  });

  it("returns nearest positive ray hits for AABBs and spheres", () => {
    const aabb: Aabb = { min: [0, 0, 0], max: [1, 1, 1] };
    const ray: Ray = { origin: [-1, 0.5, 0.5], direction: [1, 0, 0] };

    const aabbHit = intersectRayAabb(ray, aabb);

    expect(aabbHit?.distance).toBeCloseTo(1, CLOSE_TO);
    expectVec3(aabbHit?.point, [0, 0.5, 0.5]);
    expectVec3(
      aabbHit?.point,
      wgpuVec3.addScaled(ray.origin, ray.direction, 1),
    );
    expect(rayIntersectsAabb(ray, aabb)).toBe(true);
    expect(
      rayIntersectsAabb({ origin: [-1, 2, 0], direction: [1, 0, 0] }, aabb),
    ).toBe(false);

    const sphere: BoundingSphere = { center: [0, 0, 0], radius: 1 };
    const sphereHit = intersectRaySphere(
      { origin: [0, 0, -3], direction: [0, 0, 1] },
      sphere,
    );

    expect(sphereHit?.distance).toBeCloseTo(2, CLOSE_TO);
    expectVec3(sphereHit?.point, [0, 0, -1]);
    expect(
      rayIntersectsSphere({ origin: [3, 0, 0], direction: [0, 0, 1] }, sphere),
    ).toBe(false);
  });
});

function expectVec3(actual: Vec3Like | undefined, expected: Vec3Like): void {
  expect(actual).toBeDefined();

  if (actual === undefined) {
    return;
  }

  expect(actual[0]).toBeCloseTo(expected[0], CLOSE_TO);
  expect(actual[1]).toBeCloseTo(expected[1], CLOSE_TO);
  expect(actual[2]).toBeCloseTo(expected[2], CLOSE_TO);
}
