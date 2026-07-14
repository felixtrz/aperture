import { describe, expect, it } from "vitest";

import { createFpsCameraController } from "@aperture-engine/app";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import {
  LocalTransform,
  createWorld,
  registerTransformComponents,
} from "@aperture-engine/simulation";

// H1 (vitest): the pointer-lock FPS controller maps RAW pointer-lock movement
// (pixel deltas × sensitivity) to yaw/pitch, clamps pitch inside the poles, and
// walks GROUND-CONSTRAINED — forward() is level (y = 0) regardless of pitch, so
// moving forward never gains or loses altitude. Pure math — no world needed for
// the pose assertions.

const CAMERA: EcsEntityRef = { index: 7, generation: 1 };

describe("fps camera controller math (H1)", () => {
  it("maps raw pointer-lock pixel deltas to yaw/pitch scaled by sensitivity", () => {
    const sensitivity = 0.01;
    const c = createFpsCameraController({ camera: CAMERA, sensitivity });

    // Moving the mouse right turns right (yaw increases).
    c.lookFromPointerLock(10, 0);
    expect(c.yaw).toBeCloseTo(10 * sensitivity, 10);
    expect(c.pitch).toBeCloseTo(0, 10);

    // Moving the mouse down looks down (pitch decreases).
    c.lookFromPointerLock(0, 5);
    expect(c.pitch).toBeCloseTo(-5 * sensitivity, 10);
  });

  it("clamps pitch strictly inside the poles (no gimbal flip)", () => {
    const c = createFpsCameraController({ camera: CAMERA, sensitivity: 0.01 });
    // A huge downward mouse sweep would push pitch past −90°; it must clamp.
    c.lookFromPointerLock(0, 100000);
    expect(c.pitch).toBeGreaterThan(-Math.PI / 2);
    expect(c.pitch).toBeLessThan(-Math.PI / 2 + 0.01);
    // A huge upward sweep clamps at the top pole, symmetric.
    c.lookFromPointerLock(0, -1000000);
    expect(c.pitch).toBeLessThan(Math.PI / 2);
    expect(c.pitch).toBeGreaterThan(Math.PI / 2 - 0.01);
  });

  it("keeps forward() level (ground-constrained) even when looking up/down", () => {
    const c = createFpsCameraController({
      camera: CAMERA,
      yaw: 0,
      pitch: Math.PI / 3, // looking well up
    });
    // The movement forward is horizontal: Y is exactly zero.
    const f = c.forward();
    expect(f[0]).toBeCloseTo(0, 10);
    expect(f[1]).toBe(0);
    expect(f[2]).toBeCloseTo(-1, 10);
    // The look direction the camera faces IS pitched (distinct from forward()).
    expect(c.lookDirection()[1]).toBeCloseTo(Math.sin(Math.PI / 3), 10);
  });

  it("walks level along forward() and strafes on the right axis", () => {
    const c = createFpsCameraController({
      camera: CAMERA,
      pitch: Math.PI / 4, // looking up 45°
    });
    c.move(2, 0, 0); // forward 2 -> level along -Z, no altitude gain
    expect(c.position[0]).toBeCloseTo(0, 10);
    expect(c.position[1]).toBe(0); // stayed level despite the upward pitch
    expect(c.position[2]).toBeCloseTo(-2, 10);

    c.move(0, 1, 0); // strafe right -> +X, still level
    expect(c.position[0]).toBeCloseTo(1, 10);
    expect(c.position[1]).toBe(0);

    c.move(0, 0, 3); // eye height / vertical
    expect(c.position[1]).toBeCloseTo(3, 10);
  });

  it("writes the camera LocalTransform via the component path", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const entity = world.createEntity();
    const ref: EcsEntityRef = {
      index: entity.index,
      generation: entity.generation,
    };

    const c = createFpsCameraController({ camera: ref, position: [1, 2, 3] });
    expect(c.applyTo(world)).toBe(true);

    const translation = Array.from(
      entity.getVectorView(LocalTransform, "translation"),
    );
    expect(translation).toEqual([1, 2, 3]);
    const rotation = Array.from(
      entity.getVectorView(LocalTransform, "rotation"),
    );
    expect(Math.hypot(...rotation)).toBeCloseTo(1, 6);
  });

  it("returns false when the camera ref no longer resolves", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const c = createFpsCameraController({
      camera: { index: 99, generation: 1 },
    });
    expect(c.applyTo(world)).toBe(false);
  });
});
