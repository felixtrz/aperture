import { describe, expect, it } from "vitest";

import {
  raycast,
  type RaycastableBounds,
  type Vec3Like,
} from "@aperture-engine/core";

const CLOSE_TO = 5;

describe("Aperture raycaster", () => {
  it("returns sorted entity hits through known world bounds", () => {
    const world = [
      bounds("far", [0, 0, 5], [1, 1, 6]),
      bounds("near", [0, 0, 1], [1, 1, 2]),
      bounds("miss", [4, 0, 1], [5, 1, 2]),
    ];

    const hits = raycast(world, [0.5, 0.5, -1], [0, 0, 5]);

    expect(hits.map((hit) => hit.entity)).toEqual(["near", "far"]);
    expect(hits[0]?.distance).toBeCloseTo(2, CLOSE_TO);
    expectVec3(hits[0]?.point, [0.5, 0.5, 1]);
    expect(hits[1]?.distance).toBeCloseTo(6, CLOSE_TO);
    expectVec3(hits[1]?.point, [0.5, 0.5, 5]);
  });

  it("filters by max distance and layer mask", () => {
    const world = {
      bounds: [
        bounds("default", [0, 0, 1], [1, 1, 2]),
        bounds("tool", [0, 0, 3], [1, 1, 4], { layerMask: 0b0010 }),
      ],
    };

    expect(
      raycast(world, [0.5, 0.5, -1], [0, 0, 1], {
        maxDistance: 3,
      }).map((hit) => hit.entity),
    ).toEqual(["default"]);
    expect(
      raycast(world, [0.5, 0.5, -1], [0, 0, 1], {
        layerMask: 0b0010,
      }).map((hit) => hit.entity),
    ).toEqual(["tool"]);
  });

  it("uses conservative spheres as a broad phase and ignores invalid rays", () => {
    const world = [
      {
        ...bounds("hit", [0, 0, 1], [1, 1, 2]),
        worldSphere: { center: [0.5, 0.5, 1.5], radius: 1 },
      },
      {
        ...bounds("culled", [0, 0, 3], [1, 1, 4]),
        worldSphere: { center: [5, 5, 3.5], radius: 0.25 },
      },
    ] satisfies readonly RaycastableBounds<string>[];

    expect(
      raycast(world, [0.5, 0.5, -1], [0, 0, 1]).map((hit) => hit.entity),
    ).toEqual(["hit"]);
    expect(raycast(world, [0.5, 0.5, -1], [0, 0, 0])).toEqual([]);
    expect(
      raycast(world, [0.5, 0.5, -1], [0, 0, 1], {
        maxDistance: Number.NaN,
      }),
    ).toEqual([]);
  });
});

function bounds(
  entity: string,
  min: Vec3Like,
  max: Vec3Like,
  overrides: Partial<RaycastableBounds<string>> = {},
): RaycastableBounds<string> {
  return {
    entity,
    worldAabb: { min, max },
    ...overrides,
  };
}

function expectVec3(actual: Vec3Like | undefined, expected: Vec3Like): void {
  expect(actual).toBeDefined();

  if (actual === undefined) {
    return;
  }

  expect(actual[0]).toBeCloseTo(expected[0], CLOSE_TO);
  expect(actual[1]).toBeCloseTo(expected[1], CLOSE_TO);
  expect(actual[2]).toBeCloseTo(expected[2], CLOSE_TO);
}
