import { describe, expect, it } from "vitest";

import { createArcballCameraController } from "@aperture-engine/app";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import {
  LocalTransform,
  createWorld,
  registerTransformComponents,
} from "@aperture-engine/simulation";

// H1 (vitest): the Shoemake arcball controller maps two normalized pointer
// positions onto a virtual unit sphere and accumulates the rotation carrying the
// first onto the second, orbiting a target at a fixed distance. A known drag
// rotates the eye offset predictably, rotation preserves the orbit distance, and
// a silhouette drag produces ROLL (a non-zero quaternion Z) — the 3-DOF the
// 2-DOF orbit controller can never reach. The wheel zooms.

const CAMERA: EcsEntityRef = { index: 7, generation: 1 };

function distanceToTarget(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
): number {
  return Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
}

describe("arcball camera controller math (H1)", () => {
  it("starts on the +Z axis and preserves the orbit distance", () => {
    const c = createArcballCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
    });
    const eye = c.eyePosition();
    expect(eye[0]).toBeCloseTo(0, 5);
    expect(eye[1]).toBeCloseTo(0, 5);
    expect(eye[2]).toBeCloseTo(5, 5);
    expect(c.orientation).toEqual([0, 0, 0, 1]);
  });

  it("rotates the eye toward +X on a horizontal drag (about world +Y)", () => {
    const c = createArcballCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
    });
    // Center -> right on the sphere: a 30° rotation about +Y.
    c.rotateFromDrag(0, 0, 0.5, 0);
    const eye = c.eyePosition();
    expect(eye[0]).toBeCloseTo(5 * Math.sin(Math.PI / 6), 3); // 2.5
    expect(eye[1]).toBeCloseTo(0, 4);
    expect(eye[2]).toBeCloseTo(5 * Math.cos(Math.PI / 6), 3); // 4.330
    // The orbit distance is preserved by the pure rotation.
    expect(distanceToTarget(eye, [0, 0, 0])).toBeCloseTo(5, 4);
  });

  it("rotates the eye toward +Y on a vertical drag (about world -X)", () => {
    const c = createArcballCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
    });
    c.rotateFromDrag(0, 0, 0, 0.5);
    const eye = c.eyePosition();
    expect(eye[0]).toBeCloseTo(0, 4);
    expect(eye[1]).toBeCloseTo(5 * Math.sin(Math.PI / 6), 3); // 2.5
    expect(eye[2]).toBeCloseTo(5 * Math.cos(Math.PI / 6), 3);
    expect(distanceToTarget(eye, [0, 0, 0])).toBeCloseTo(5, 4);
  });

  it("produces roll (3-DOF) from a silhouette drag — impossible for orbit", () => {
    const c = createArcballCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
    });
    // A quarter turn along the silhouette circle rolls about the view (+Z) axis.
    c.rotateFromDrag(1, 0, 0, 1);
    // The accumulated orientation carries a Z (roll) term — orbit's spherical
    // azimuth/elevation state has no roll degree of freedom.
    expect(Math.abs(c.orientation[2])).toBeGreaterThan(0.5);
    // Roll about the view axis keeps the eye on the axis but reorients up.
    const eye = c.eyePosition();
    expect(distanceToTarget(eye, [0, 0, 0])).toBeCloseTo(5, 4);
  });

  it("beginDrag/dragTo is equivalent to rotateFromDrag from the anchor", () => {
    const a = createArcballCameraController({
      camera: CAMERA,
      distance: 5,
    });
    const b = createArcballCameraController({
      camera: CAMERA,
      distance: 5,
    });
    a.rotateFromDrag(0, 0, 0.5, 0);
    b.beginDrag(0, 0);
    b.dragTo(0.5, 0);
    expect(b.orientation[0]).toBeCloseTo(a.orientation[0], 6);
    expect(b.orientation[1]).toBeCloseTo(a.orientation[1], 6);
    expect(b.orientation[2]).toBeCloseTo(a.orientation[2], 6);
    expect(b.orientation[3]).toBeCloseTo(a.orientation[3], 6);
  });

  it("zooms the orbit distance on the wheel, clamped", () => {
    const c = createArcballCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
      minDistance: 2,
      maxDistance: 12,
      zoomSpeed: 1,
    });
    c.zoomFromWheel(3);
    expect(c.distance).toBe(8);
    expect(distanceToTarget(c.eyePosition(), [0, 0, 0])).toBeCloseTo(8, 4);
    c.zoomFromWheel(-100);
    expect(c.distance).toBe(2);
    c.zoomFromWheel(1000);
    expect(c.distance).toBe(12);
  });

  it("writes the camera LocalTransform via the component path", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const entity = world.createEntity();
    const ref: EcsEntityRef = {
      index: entity.index,
      generation: entity.generation,
    };

    const c = createArcballCameraController({
      camera: ref,
      target: [0, 0, 0],
      distance: 5,
    });
    c.rotateFromDrag(0, 0, 0.4, 0.1);
    expect(c.applyTo(world)).toBe(true);
    const translation = Array.from(
      entity.getVectorView(LocalTransform, "translation"),
    );
    const eye = c.eyePosition();
    expect(translation[0]).toBeCloseTo(eye[0], 4);
    expect(translation[1]).toBeCloseTo(eye[1], 4);
    expect(translation[2]).toBeCloseTo(eye[2], 4);
    const rotation = Array.from(
      entity.getVectorView(LocalTransform, "rotation"),
    );
    expect(Math.hypot(...rotation)).toBeCloseTo(1, 6);
  });

  it("returns false when the camera ref no longer resolves", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const c = createArcballCameraController({
      camera: { index: 99, generation: 1 },
    });
    expect(c.applyTo(world)).toBe(false);
  });
});
