import { describe, expect, it } from "vitest";

import { createMapCameraController } from "@aperture-engine/app";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import {
  LocalTransform,
  createWorld,
  registerTransformComponents,
} from "@aperture-engine/simulation";

// H1 (vitest): the pan/map controller pans its target across the ground (XZ)
// plane from a pointer drag (the eye follows by the same XZ delta), dollies the
// eye on wheel zoom (changing the target distance), rotates the heading, and
// clamps pitch strictly inside the poles. Pure math for the pose assertions.

const CAMERA: EcsEntityRef = { index: 7, generation: 1 };

function distanceToTarget(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
): number {
  return Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
}

describe("map camera controller math (H1)", () => {
  it("pans the target across the XZ plane and the eye follows", () => {
    const c = createMapCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 10,
      pitch: Math.PI / 4,
      heading: 0,
      panSpeed: 1,
    });

    const eyeBefore = c.eyePosition();
    // Drag right: grab-drag slides the world right, so the target moves −X.
    c.panFromDrag(0.1, 0);
    expect(c.target[0]).toBeCloseTo(-1, 6); // 0.1 * panSpeed * distance(10)
    expect(c.target[1]).toBe(0); // stays on the ground plane
    expect(c.target[2]).toBeCloseTo(0, 6);

    const eyeAfterX = c.eyePosition();
    // The eye follows the pan by the same XZ delta (height unchanged).
    expect(eyeAfterX[0] - eyeBefore[0]).toBeCloseTo(-1, 6);
    expect(eyeAfterX[1]).toBeCloseTo(eyeBefore[1], 6);
    expect(eyeAfterX[2] - eyeBefore[2]).toBeCloseTo(0, 6);

    // Drag down pans along the ground-forward axis (target moves +Z at heading 0).
    c.panFromDrag(0, 0.1);
    expect(c.target[2]).toBeCloseTo(1, 6);
    expect(c.target[1]).toBe(0);
  });

  it("dollies the eye on wheel zoom (distance changes, clamped)", () => {
    const c = createMapCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 10,
      minDistance: 2,
      maxDistance: 20,
      zoomSpeed: 1,
    });
    expect(distanceToTarget(c.eyePosition(), [0, 0, 0])).toBeCloseTo(10, 6);

    // Negative wheel zooms in (dolly toward the target).
    c.zoomFromWheel(-3);
    expect(c.distance).toBe(7);
    expect(distanceToTarget(c.eyePosition(), [0, 0, 0])).toBeCloseTo(7, 6);

    // Clamps at the configured bounds.
    c.zoomFromWheel(-100);
    expect(c.distance).toBe(2);
    c.zoomFromWheel(1000);
    expect(c.distance).toBe(20);
  });

  it("rotates the heading around the target, keeping distance constant", () => {
    const c = createMapCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 10,
      pitch: Math.PI / 4,
      heading: 0,
    });
    const before = c.eyePosition();
    c.rotate(Math.PI / 2);
    expect(c.heading).toBeCloseTo(Math.PI / 2, 10);
    const after = c.eyePosition();
    // The eye orbited around the target (moved) but kept its distance/height.
    expect(distanceToTarget(after, [0, 0, 0])).toBeCloseTo(10, 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
    expect(
      Math.hypot(after[0] - before[0], after[2] - before[2]),
    ).toBeGreaterThan(1);
  });

  it("clamps a configured top-down pitch strictly inside the poles", () => {
    const c = createMapCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 10,
      pitch: Math.PI, // absurd top-down request
    });
    expect(c.pitch).toBeLessThan(Math.PI / 2);
    expect(c.pitch).toBeGreaterThan(0);
    // Eye never lands on the target's vertical axis (basis stays valid).
    const eye = c.eyePosition();
    expect(Math.hypot(eye[0], eye[2])).toBeGreaterThan(0);
  });

  it("writes the camera LocalTransform via the component path", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const entity = world.createEntity();
    const ref: EcsEntityRef = {
      index: entity.index,
      generation: entity.generation,
    };

    const c = createMapCameraController({
      camera: ref,
      target: [0, 0, 0],
      distance: 8,
    });
    expect(c.applyTo(world)).toBe(true);
    const translation = Array.from(
      entity.getVectorView(LocalTransform, "translation"),
    );
    const eye = c.eyePosition();
    expect(translation[0]).toBeCloseTo(eye[0], 5);
    expect(translation[1]).toBeCloseTo(eye[1], 5);
    expect(translation[2]).toBeCloseTo(eye[2], 5);
    const rotation = Array.from(
      entity.getVectorView(LocalTransform, "rotation"),
    );
    expect(Math.hypot(...rotation)).toBeCloseTo(1, 6);
  });

  it("returns false when the camera ref no longer resolves", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const c = createMapCameraController({
      camera: { index: 99, generation: 1 },
    });
    expect(c.applyTo(world)).toBe(false);
  });
});
