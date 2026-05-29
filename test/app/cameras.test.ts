import { describe, expect, it } from "vitest";

import { createApertureSystemContext } from "@aperture-engine/app/systems";
import {
  Camera,
  CameraProjection,
  createCamera,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  WorldTransform,
  createRootTransform,
  createWorld,
  type Entity,
  type Vec3Like,
} from "@aperture-engine/simulation";

function createTestContext() {
  const world = createWorld({ entityCapacity: 8 });
  const context = createApertureSystemContext({
    world,
    assetsRegistry: new AssetRegistry(),
  });

  return { context, world };
}

function createCameraEntity(
  world: ReturnType<typeof createWorld>,
  options: {
    readonly projection?: CameraProjection;
    readonly translation?: Vec3Like;
    readonly fovYRadians?: number;
    readonly aspect?: number;
    readonly near?: number;
    readonly far?: number;
    readonly orthographicHeight?: number;
  } = {},
): Entity {
  const entity = world.createEntity();
  const transform = createRootTransform({
    translation: options.translation ?? [0, 0, 5],
  });

  entity.addComponent(WorldTransform, transform.world);
  entity.addComponent(
    Camera,
    createCamera({
      projection: options.projection ?? CameraProjection.Perspective,
      fovYRadians: options.fovYRadians ?? Math.PI / 2,
      aspect: options.aspect ?? 1,
      near: options.near ?? 1,
      far: options.far ?? 11,
      orthographicHeight: options.orthographicHeight ?? 4,
    }),
  );

  return entity;
}

function expectVectorCloseTo(
  actual: Vec3Like,
  expected: readonly [number, number, number],
  precision = 4,
): void {
  expect(readVec3(actual, 0)).toBeCloseTo(expected[0], precision);
  expect(readVec3(actual, 1)).toBeCloseTo(expected[1], precision);
  expect(readVec3(actual, 2)).toBeCloseTo(expected[2], precision);
}

function readVec3(value: Vec3Like, index: 0 | 1 | 2): number {
  const next = value[index];

  if (next === undefined) {
    throw new RangeError(`Expected Vec3Like value at index ${index}.`);
  }

  return next;
}

describe("camera system access", () => {
  it("unprojects perspective pointer coordinates into camera-space rays", () => {
    const { context, world } = createTestContext();

    createCameraEntity(world);

    const centerRay = context.cameras.main.rayFromPointer([0.5, 0.5]);
    const cornerRay = context.cameras.main.rayFromPointer([1, 0]);
    const corner = 1 / Math.sqrt(3);

    expectVectorCloseTo(centerRay.origin, [0, 0, 5]);
    expectVectorCloseTo(centerRay.direction, [0, 0, -1]);
    expectVectorCloseTo(cornerRay.origin, [0, 0, 5]);
    expectVectorCloseTo(cornerRay.direction, [corner, corner, -corner]);
  });

  it("unprojects orthographic pointer coordinates with parallel camera rays", () => {
    const { context, world } = createTestContext();

    createCameraEntity(world, {
      projection: CameraProjection.Orthographic,
      aspect: 2,
      orthographicHeight: 4,
    });

    const centerRay = context.cameras.main.rayFromPointer([0.5, 0.5]);
    const cornerRay = context.cameras.main.rayFromPointer([1, 0]);

    expectVectorCloseTo(centerRay.origin, [0, 0, 4]);
    expectVectorCloseTo(centerRay.direction, [0, 0, -1]);
    expectVectorCloseTo(cornerRay.origin, [4, 2, 4]);
    expectVectorCloseTo(cornerRay.direction, [0, 0, -1]);
  });

  it("feeds unprojected rays into spatial bounds picking", () => {
    const { context, world } = createTestContext();
    const target = world.createEntity();

    createCameraEntity(world);
    context.spatial.setBounds([
      {
        entity: target,
        worldAabb: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      },
    ]);

    const hit = context.spatial.raycastFirst(
      context.cameras.main.rayFromPointer([0.5, 0.5]),
      { maxDistance: 10 },
    );
    const miss = context.spatial.raycastFirst(
      context.cameras.main.rayFromPointer([1, 0]),
      { maxDistance: 10 },
    );

    expect(hit?.entity.entity).toBe(target);
    expect(hit?.source).toBe("bounds");
    expect(miss).toBeNull();
  });
});
