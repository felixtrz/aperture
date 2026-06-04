import { describe, expect, it } from "vitest";
import { createOrbitCameraController } from "@aperture-engine/app";
import type { EcsEntityRef } from "@aperture-engine/app/config";

// M7-T9 Done-when #4 (vitest): the orbit controller math maps a given drag delta
// to the expected azimuth/elevation change and clamps elevation to avoid the
// gimbal flip at the poles. Pure math — no world needed.

const CAMERA: EcsEntityRef = { index: 7, generation: 1 };

function distanceToTarget(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
): number {
  return Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
}

describe("orbit camera controller math (M7-T9)", () => {
  it("maps a normalized pointer drag delta to azimuth/elevation", () => {
    const rotateSpeed = Math.PI;
    const controller = createOrbitCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
      azimuth: 0,
      elevation: 0,
      rotateSpeed,
    });

    // Horizontal drag rotates azimuth; vertical drag rotates elevation (inverted
    // so dragging up raises the camera). Distance is untouched by rotation.
    controller.orbitFromDrag(0.25, 0);
    expect(controller.azimuth).toBeCloseTo(0.25 * rotateSpeed, 10);
    expect(controller.elevation).toBeCloseTo(0, 10);
    expect(controller.distance).toBe(5);

    controller.orbitFromDrag(0, 0.1);
    expect(controller.azimuth).toBeCloseTo(0.25 * rotateSpeed, 10);
    expect(controller.elevation).toBeCloseTo(-0.1 * rotateSpeed, 10);
  });

  it("clamps elevation strictly inside the poles (no gimbal flip)", () => {
    const controller = createOrbitCameraController({
      camera: CAMERA,
      target: [0, 0, 0],
      distance: 5,
      rotateSpeed: Math.PI,
    });

    // A huge upward drag would push elevation past +90°; it must clamp below it.
    controller.orbitFromDrag(0, -100);
    expect(controller.elevation).toBeLessThan(Math.PI / 2);
    expect(controller.elevation).toBeGreaterThan(Math.PI / 2 - 0.01);
    const maxElevation = controller.elevation;

    // A huge downward drag clamps at the lower pole, symmetric.
    controller.orbitFromDrag(0, 100);
    expect(controller.elevation).toBeGreaterThan(-Math.PI / 2);
    expect(controller.elevation).toBeCloseTo(-maxElevation, 10);

    // The eye never sits exactly on the target's vertical axis (basis stays valid).
    const eye = controller.eyePosition();
    expect(Math.hypot(eye[0], eye[2])).toBeGreaterThan(0);
  });

  it("keeps a constant target distance under rotation and changes it on zoom", () => {
    const controller = createOrbitCameraController({
      camera: CAMERA,
      target: [1, 2, 3],
      distance: 6,
      minDistance: 0.5,
    });

    const before = controller.eyePosition();
    expect(distanceToTarget(before, [1, 2, 3])).toBeCloseTo(6, 6);

    controller.orbitFromDrag(0.3, -0.2);
    const rotated = controller.eyePosition();
    expect(distanceToTarget(rotated, [1, 2, 3])).toBeCloseTo(6, 6);
    // The eye actually moved (orbited) around the target.
    expect(
      Math.hypot(
        rotated[0] - before[0],
        rotated[1] - before[1],
        rotated[2] - before[2],
      ),
    ).toBeGreaterThan(0.1);

    controller.zoom(3);
    expect(controller.distance).toBe(9);
    expect(distanceToTarget(controller.eyePosition(), [1, 2, 3])).toBeCloseTo(
      9,
      6,
    );

    // Zoom clamps at minDistance.
    controller.zoom(-100);
    expect(controller.distance).toBe(0.5);
  });
});
