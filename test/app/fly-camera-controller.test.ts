import { describe, expect, it } from "vitest";

import { createFlyCameraController } from "@aperture-engine/app";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import {
  LocalTransform,
  createWorld,
  registerTransformComponents,
} from "@aperture-engine/simulation";

const CAMERA: EcsEntityRef = { index: 7, generation: 1 };

describe("fly camera controller math", () => {
  it("maps a normalized pointer drag delta to yaw/pitch", () => {
    const lookSpeed = Math.PI;
    const c = createFlyCameraController({ camera: CAMERA, lookSpeed });

    c.lookFromDrag(0.25, 0);
    expect(c.yaw).toBeCloseTo(0.25 * lookSpeed, 10);
    expect(c.pitch).toBeCloseTo(0, 10);

    // Drag down looks down (pitch decreases).
    c.lookFromDrag(0, 0.1);
    expect(c.pitch).toBeCloseTo(-0.1 * lookSpeed, 10);
  });

  it("clamps pitch strictly inside the poles", () => {
    const c = createFlyCameraController({ camera: CAMERA, lookSpeed: Math.PI });
    c.look(0, 100);
    expect(c.pitch).toBeLessThan(Math.PI / 2);
    expect(c.pitch).toBeGreaterThan(Math.PI / 2 - 0.01);
    c.look(0, -100);
    expect(c.pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it("derives a forward/right basis from yaw=0,pitch=0", () => {
    const c = createFlyCameraController({ camera: CAMERA });
    const f = c.forward();
    expect(f[0]).toBeCloseTo(0, 10);
    expect(f[1]).toBeCloseTo(0, 10);
    expect(f[2]).toBeCloseTo(-1, 10); // default camera looks down -Z
    const r = c.right();
    expect(r).toEqual([1, 0, 0]);
  });

  it("moves along the view basis (forward/right/world-up)", () => {
    const c = createFlyCameraController({ camera: CAMERA });
    c.move(2, 0, 0); // forward 2 -> -Z
    expect(c.position[0]).toBeCloseTo(0, 10);
    expect(c.position[2]).toBeCloseTo(-2, 10);
    c.move(0, 1, 0); // right 1 -> +X
    expect(c.position[0]).toBeCloseTo(1, 10);
    c.move(0, 0, 3); // up 3 -> +Y
    expect(c.position[1]).toBeCloseTo(3, 10);
  });

  it("flies along the pitched forward (forward motion gains altitude when looking up)", () => {
    const c = createFlyCameraController({ camera: CAMERA, pitch: Math.PI / 6 });
    c.move(1, 0, 0);
    expect(c.position[1]).toBeCloseTo(Math.sin(Math.PI / 6), 10);
  });

  it("writes the camera LocalTransform via the component path", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const entity = world.createEntity();
    const ref: EcsEntityRef = {
      index: entity.index,
      generation: entity.generation,
    };

    const c = createFlyCameraController({ camera: ref, position: [1, 2, 3] });
    expect(c.applyTo(world)).toBe(true);

    const translation = Array.from(
      entity.getVectorView(LocalTransform, "translation"),
    );
    expect(translation).toEqual([1, 2, 3]);
    // A look-at rotation is a unit quaternion.
    const rotation = Array.from(
      entity.getVectorView(LocalTransform, "rotation"),
    );
    expect(Math.hypot(...rotation)).toBeCloseTo(1, 6);
  });

  it("returns false when the camera ref no longer resolves", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    const c = createFlyCameraController({
      camera: { index: 99, generation: 1 },
    });
    expect(c.applyTo(world)).toBe(false);
  });
});
