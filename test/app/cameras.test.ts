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

function normalize(
  value: readonly [number, number, number],
): [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);
  return [value[0] / length, value[1] / length, value[2] / length];
}

function distance(a: Vec3Like, b: readonly [number, number, number]): number {
  return Math.hypot(
    readVec3(a, 0) - b[0],
    readVec3(a, 1) - b[1],
    readVec3(a, 2) - b[2],
  );
}

describe("camera system access", () => {
  it("unprojects perspective pointer coordinates into camera-space rays", () => {
    const { context, world } = createTestContext();

    createCameraEntity(world);

    const centerRay = context.cameras.main.rayFromPointer([0.5, 0.5]);
    const cornerRay = context.cameras.main.rayFromPointer([1, 0]);
    const corner = 1 / Math.sqrt(3);

    // Perspective rays start at the near-plane point under the pointer (near = 1
    // unit in front of the eye at [0,0,5]).
    expectVectorCloseTo(centerRay.origin, [0, 0, 4]);
    expectVectorCloseTo(centerRay.direction, [0, 0, -1]);
    expectVectorCloseTo(cornerRay.origin, [1, 1, 4]);
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

  it("throws a structured invalid-projection error for bad projection params", () => {
    const { context, world } = createTestContext();
    // far < near is invalid; the guard must surface the friendly camera error
    // rather than a raw RangeError from makePerspective.
    createCameraEntity(world, { near: 2, far: 1 });
    expect(() => context.cameras.main.rayFromPointer([0.5, 0.5])).toThrowError(
      /requires a valid projection/,
    );
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

  it("rays a look-at perspective camera toward the target with a near-plane origin (M7-T7 #1)", () => {
    const { context } = createTestContext();

    context.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 1.5, 5], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
      camera: { near: 0.1, far: 100, aspect: 1 },
    });

    const ray = context.cameras.main.rayFromPointer([0.5, 0.5]);
    const eye: [number, number, number] = [0, 1.5, 5];
    const forward = normalize([0, -1.5, -5]);

    // Direction points from the camera toward the look target.
    expectVectorCloseTo(ray.direction, forward, 3);
    // Origin lies on the near plane: `near` units in front of the eye.
    expect(distance(ray.origin, eye)).toBeCloseTo(0.1, 4);
    expectVectorCloseTo(
      ray.origin,
      [
        eye[0] + forward[0] * 0.1,
        eye[1] + forward[1] * 0.1,
        eye[2] + forward[2] * 0.1,
      ],
      4,
    );
  });

  it("spreads perspective corner rays by the half-fov and flips NDC Y (M7-T7 #2)", () => {
    const { context, world } = createTestContext();

    createCameraEntity(world, {
      fovYRadians: Math.PI / 3,
      aspect: 1,
      near: 1,
      far: 11,
    });

    const center = context.cameras.main.rayFromPointer([0.5, 0.5]);
    const topLeft = context.cameras.main.rayFromPointer([0, 0]);
    const bottomRight = context.cameras.main.rayFromPointer([1, 1]);
    const t = Math.tan(Math.PI / 6); // half of a 60deg fov

    expectVectorCloseTo(center.direction, [0, 0, -1], 4);
    // Top-left pointer -> up (+y) + left (-x); screen y=0 is the top (NDC Y flip).
    expectVectorCloseTo(topLeft.direction, normalize([-t, t, -1]), 4);
    // Bottom-right pointer -> down (-y) + right (+x).
    expectVectorCloseTo(bottomRight.direction, normalize([t, -t, -1]), 4);
    expect(readVec3(topLeft.direction, 1)).toBeGreaterThan(0);
    expect(readVec3(bottomRight.direction, 1)).toBeLessThan(0);
  });

  it("produces parallel orthographic rays with varying origins (M7-T7 #4)", () => {
    const { context, world } = createTestContext();

    createCameraEntity(world, {
      projection: CameraProjection.Orthographic,
      aspect: 2,
      orthographicHeight: 4,
    });

    const a = context.cameras.main.rayFromPointer([0.5, 0.5]);
    const b = context.cameras.main.rayFromPointer([0, 0]);
    const c = context.cameras.main.rayFromPointer([1, 1]);

    // Parallel: identical direction regardless of pointer position.
    expectVectorCloseTo(a.direction, [0, 0, -1], 4);
    expectVectorCloseTo(b.direction, [0, 0, -1], 4);
    expectVectorCloseTo(c.direction, [0, 0, -1], 4);
    // Origins vary across the orthographic near plane.
    expect(
      distance(a.origin, [
        readVec3(b.origin, 0),
        readVec3(b.origin, 1),
        readVec3(b.origin, 2),
      ]),
    ).toBeGreaterThan(0.5);
  });
});
