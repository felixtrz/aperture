import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createRotateGizmo, createScaleGizmo } from "@aperture-engine/app";
import { LocalTransform } from "@aperture-engine/simulation";
import type { Entity, EcsWorld } from "@aperture-engine/simulation";
import { Pickable, createPickable } from "@aperture-engine/render";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { EcsEntityRef } from "@aperture-engine/app/config";

// H2 render-control (headless) proofs that the rotate + scale gizmos drive the
// SAME interaction frame as the translate gizmo (scripted pointer press + drag →
// LocalTransform write). The pixel-readback halves are proven by the browser E2E
// routes (rotate-gizmo / scale-gizmo specs).

interface CapturedRefs {
  target: Entity | null;
}

function ref(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function localRotation(entity: Entity): [number, number, number, number] {
  const r = entity.getVectorView(LocalTransform, "rotation");
  return [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 1];
}

function localScale(entity: Entity): [number, number, number] {
  const s = entity.getVectorView(LocalTransform, "scale");
  return [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1];
}

function isSnappedTo(value: number, increment: number): boolean {
  return Math.abs(value / increment - Math.round(value / increment)) < 1e-4;
}

function setupSystem(refs: CapturedRefs): ApertureSystemModule {
  return {
    default: class TransformGizmoRouteSetup extends createSystem({
      priority: 0,
    }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
          camera: { aspect: 1 },
        });
        const target = this.spawn.mesh({
          key: "target",
          mesh: mesh.box({ size: 0.4 }),
          material: material.standard(),
          transform: { translation: [0, 0, 0] },
        });
        target.addComponent(Pickable, createPickable({ enabled: true }));
        refs.target = target;
      }
    },
  };
}

async function createRoute(
  refs: CapturedRefs,
): Promise<ApertureHeadlessRunner> {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [setupSystem(refs)],
  });
}

// Screen coordinate for a world XY point at z=0 with the camera at [0,0,8],
// fovY 60°, aspect 1 (matches the setup above). Used to aim the pointer at a
// specific angle on the +Z rotation ring.
function screenFromWorldXY(x: number, y: number): [number, number] {
  const halfExtent = Math.tan((60 * Math.PI) / 360) * 8; // tan(fovY/2) * distance
  return [0.5 + x / (2 * halfExtent), 0.5 - y / (2 * halfExtent)];
}

describe("rotate gizmo route (H2)", () => {
  it("drags the +Z ring to rotate the target about world Z, snapped to π/4", async () => {
    const refs: CapturedRefs = { target: null };
    const runner = await createRoute(refs);
    const target = refs.target as Entity;
    const world = runner.app.context.world as EcsWorld;
    const ctx = runner.app.context;

    const gizmo = createRotateGizmo(
      {
        world,
        spawn: ctx.spawn,
        hierarchy: ctx.hierarchy,
        interaction: ctx.interaction,
        cameras: ctx.cameras,
      },
      { target: ref(target), size: 3, thickness: 0.12, snapAngle: Math.PI / 4 },
    );
    gizmo.sync(world);
    runner.step(1 / 60, 0);

    const rotationBefore = localRotation(target);
    expect(rotationBefore).toEqual([0, 0, 0, 1]);

    const pointer = ctx.input.pointer.primary;
    const radius = 3;
    const aim = (degrees: number): void => {
      const rad = (degrees * Math.PI) / 180;
      pointer.position.value = screenFromWorldXY(
        radius * Math.cos(rad),
        radius * Math.sin(rad),
      );
    };

    // Press at 20° on the +Z ring (first-quadrant diagonal, where only the +Z
    // ring's bounds are under the ray), then sweep CCW to ~65°.
    aim(20);
    pointer.pressed.value = false;
    gizmo.sync(world);
    runner.step(1 / 60, 0.1);
    pointer.pressed.value = true;
    gizmo.sync(world);
    runner.step(1 / 60, 0.2);
    aim(25);
    gizmo.sync(world);
    runner.step(1 / 60, 0.3);
    aim(45);
    gizmo.sync(world);
    runner.step(1 / 60, 0.4);
    aim(65);
    gizmo.sync(world);
    runner.step(1 / 60, 0.5);
    pointer.pressed.value = false;
    gizmo.sync(world);
    runner.step(1 / 60, 0.6);

    const rotationAfter = localRotation(target);
    // Rotation happened.
    expect(Math.abs(rotationAfter[3] - rotationBefore[3])).toBeGreaterThan(
      1e-3,
    );
    // Pure rotation about world Z: the X/Y quaternion components stay ~0 (a
    // perpendicular axis is unaffected).
    expect(Math.abs(rotationAfter[0])).toBeLessThan(1e-5);
    expect(Math.abs(rotationAfter[1])).toBeLessThan(1e-5);
    expect(rotationAfter[2]).toBeGreaterThan(0); // +Z (CCW) sweep.
    // Snapped: the applied angle is exactly π/4.
    const angle = 2 * Math.atan2(rotationAfter[2], rotationAfter[3]);
    expect(angle).toBeCloseTo(Math.PI / 4, 4);

    gizmo.dispose();
  });
});

describe("scale gizmo route (H2)", () => {
  it("drags the X handle to scale the target along X only, snapped to 0.5", async () => {
    const refs: CapturedRefs = { target: null };
    const runner = await createRoute(refs);
    const target = refs.target as Entity;
    const world = runner.app.context.world as EcsWorld;
    const ctx = runner.app.context;

    const gizmo = createScaleGizmo(
      {
        world,
        spawn: ctx.spawn,
        hierarchy: ctx.hierarchy,
        interaction: ctx.interaction,
        cameras: ctx.cameras,
      },
      { target: ref(target), size: 3, thickness: 0.5, snapIncrement: 0.5 },
    );
    gizmo.sync(world);
    runner.step(1 / 60, 0);

    const scaleBefore = localScale(target);
    expect(scaleBefore).toEqual([1, 1, 1]);

    const pointer = ctx.input.pointer.primary;
    const point = (x: number): void => {
      pointer.position.value = [x, 0.5];
    };

    // Press on the +X handle, then drag rightward (increasing world X → grow).
    point(0.62);
    pointer.pressed.value = false;
    gizmo.sync(world);
    runner.step(1 / 60, 0.1);
    pointer.pressed.value = true;
    gizmo.sync(world);
    runner.step(1 / 60, 0.2);
    point(0.72);
    gizmo.sync(world);
    runner.step(1 / 60, 0.3);
    point(0.85);
    gizmo.sync(world);
    runner.step(1 / 60, 0.4);
    point(0.92);
    gizmo.sync(world);
    runner.step(1 / 60, 0.5);
    pointer.pressed.value = false;
    gizmo.sync(world);
    runner.step(1 / 60, 0.6);

    const scaleAfter = localScale(target);
    // X grew measurably and is snapped to a multiple of 0.5.
    expect(scaleAfter[0]).toBeGreaterThan(1.2);
    expect(isSnappedTo(scaleAfter[0], 0.5)).toBe(true);
    // The other axes stayed fixed.
    expect(scaleAfter[1]).toBeCloseTo(1, 6);
    expect(scaleAfter[2]).toBeCloseTo(1, 6);

    gizmo.dispose();
  });
});
