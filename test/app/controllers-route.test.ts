import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createOrbitCameraController,
  createTranslateGizmo,
} from "@aperture-engine/app";
import { LocalTransform, WorldTransform } from "@aperture-engine/simulation";
import type { Entity, EcsWorld } from "@aperture-engine/simulation";
import { Pickable, createPickable } from "@aperture-engine/render";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { EcsEntityRef } from "@aperture-engine/app/config";

// M7-T9 render-control (headless) proofs of the controller TRANSFORMS:
//  #1 orbit horizontal drag rotates the camera around the target — azimuth
//     changes while the distance to the target stays constant.
//  #2 zoom changes the camera distance to the target.
//  #3 dragging the X-axis handle translates the selected entity along world X
//     only (Y/Z unchanged) and the gizmo handles follow the entity.
// (The pixel-readback halves of #1/#2/#3 are proven by the browser E2E routes.)

interface CapturedRefs {
  camera: Entity | null;
  target: Entity | null;
}

function ref(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function worldTranslation(entity: Entity): [number, number, number] {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}

function localTranslation(entity: Entity): [number, number, number] {
  const t = entity.getVectorView(LocalTransform, "translation");
  return [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0];
}

function entityByRef(world: EcsWorld, target: EcsEntityRef): Entity {
  const entity = world.entityManager.getEntityByIndex(target.index);
  if (entity === null) {
    throw new Error(`No entity at index ${target.index}`);
  }
  return entity;
}

function distance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function setupSystem(
  refs: CapturedRefs,
  cameraPosition: readonly [number, number, number],
): ApertureSystemModule {
  return {
    default: class ControllerRouteSetup extends createSystem({ priority: 0 }) {
      override init(): void {
        refs.camera = this.spawn.camera({
          key: "camera.main",
          transform: { translation: cameraPosition, lookAt: [0, 0, 0] },
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
  cameraPosition: readonly [number, number, number],
): Promise<ApertureHeadlessRunner> {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [setupSystem(refs, cameraPosition)],
  });
}

describe("orbit camera controller route (M7-T9)", () => {
  it("rotates the camera around the target at a constant distance, and zooms", async () => {
    const refs: CapturedRefs = { camera: null, target: null };
    const runner = await createRoute(refs, [0, 0, 5]);
    const camera = refs.camera as Entity;
    const world = runner.app.context.world as EcsWorld;

    const controller = createOrbitCameraController({
      camera: ref(camera),
      target: [0, 0, 0],
      distance: 5,
      azimuth: 0,
      elevation: 0,
    });

    controller.applyTo(world);
    runner.step(1 / 60, 0);
    const eye0 = localTranslation(camera);
    expect(distance(eye0, [0, 0, 0])).toBeCloseTo(5, 3);
    const azimuth0 = Math.atan2(eye0[0], eye0[2]);

    // Horizontal drag → orbit. Azimuth changes; distance to target is preserved.
    controller.orbitFromDrag(0.15, 0);
    controller.applyTo(world);
    runner.step(1 / 60, 0.1);
    const eye1 = localTranslation(camera);
    const azimuth1 = Math.atan2(eye1[0], eye1[2]);
    expect(Math.abs(azimuth1 - azimuth0)).toBeGreaterThan(0.1);
    expect(distance(eye1, [0, 0, 0])).toBeCloseTo(5, 3);

    // Zoom → distance to target changes.
    const distanceBeforeZoom = distance(localTranslation(camera), [0, 0, 0]);
    controller.zoom(3);
    controller.applyTo(world);
    runner.step(1 / 60, 0.2);
    const distanceAfterZoom = distance(localTranslation(camera), [0, 0, 0]);
    expect(distanceAfterZoom).toBeCloseTo(8, 3);
    expect(distanceAfterZoom - distanceBeforeZoom).toBeGreaterThan(2);
  });
});

describe("translate gizmo route (M7-T9)", () => {
  it("drags the X handle to translate the target along world X only, handles follow", async () => {
    const refs: CapturedRefs = { camera: null, target: null };
    const runner = await createRoute(refs, [0, 0, 8]);
    const target = refs.target as Entity;
    const world = runner.app.context.world as EcsWorld;

    const gizmo = createTranslateGizmo(
      {
        world,
        spawn: runner.app.context.spawn,
        hierarchy: runner.app.context.hierarchy,
        interaction: runner.app.context.interaction,
        cameras: runner.app.context.cameras,
      },
      { target: ref(target), size: 3, thickness: 0.5 },
    );
    // Resolve handles + populate the spatial picking index.
    runner.step(1 / 60, 0);

    const handleX = entityByRef(world, gizmo.handles.x);
    const targetBefore = worldTranslation(target);
    const handleBefore = worldTranslation(handleX);
    expect(targetBefore[0]).toBeCloseTo(0, 5);
    expect(handleBefore[0]).toBeCloseTo(1.5, 5); // local offset size/2

    const pointer = runner.app.context.input.pointer.primary;
    const point = (x: number): void => {
      pointer.position.value = [x, 0.5];
    };

    // Hover the X handle (right of center), press, then drag rightward in two
    // moves (first move crosses the drag threshold, second produces a delta).
    point(0.62);
    pointer.pressed.value = false;
    runner.step(1 / 60, 0.1);
    pointer.pressed.value = true;
    runner.step(1 / 60, 0.2);
    point(0.7);
    runner.step(1 / 60, 0.3);
    point(0.78);
    runner.step(1 / 60, 0.4);
    pointer.pressed.value = false;
    runner.step(1 / 60, 0.5);

    const targetAfter = worldTranslation(target);
    const handleAfter = worldTranslation(handleX);

    // Translated along world X only.
    expect(targetAfter[0]).toBeGreaterThan(0.2);
    expect(Math.abs(targetAfter[1] - targetBefore[1])).toBeLessThan(1e-4);
    expect(Math.abs(targetAfter[2] - targetBefore[2])).toBeLessThan(1e-4);

    // The handle followed the entity (still offset by size/2 on world X).
    expect(handleAfter[0]).toBeCloseTo(targetAfter[0] + 1.5, 4);
    expect(handleAfter[0] - handleBefore[0]).toBeCloseTo(
      targetAfter[0] - targetBefore[0],
      4,
    );
  });

  it("translates a target under a rotated parent along world X (parent-inverse) with world-aligned synced handles", async () => {
    const refs: CapturedRefs = { camera: null, target: null };
    const runner = await createRoute(refs, [0, 0, 8]);
    const target = refs.target as Entity;
    const ctx = runner.app.context;
    const world = ctx.world as EcsWorld;

    // Parent the target under a node rotated 90° about Y, at the origin. The
    // world-preserving setParent keeps the target's world pose at the origin.
    const parent = ctx.spawn.mesh({
      key: "gizmo.parent",
      mesh: mesh.box({ size: 0.2 }),
      material: material.standard(),
      transform: { translation: [0, 0, 0], rotationEulerDegrees: [0, 90, 0] },
    });
    ctx.hierarchy.setParent(ref(target), {
      index: parent.index,
      generation: parent.generation,
    });

    const gizmo = createTranslateGizmo(
      {
        world,
        spawn: ctx.spawn,
        hierarchy: ctx.hierarchy,
        interaction: ctx.interaction,
        cameras: ctx.cameras,
      },
      { target: ref(target), size: 3, thickness: 0.5 },
    );
    gizmo.sync(world);
    runner.step(1 / 60, 0);
    gizmo.sync(world);

    // sync() world-aligned the handle at world +X despite the rotated parent.
    const handleX = entityByRef(world, gizmo.handles.x);
    const handleBefore = worldTranslation(handleX);
    expect(handleBefore[0]).toBeCloseTo(1.5, 3);
    expect(Math.abs(handleBefore[1])).toBeLessThan(1e-3);
    expect(Math.abs(handleBefore[2])).toBeLessThan(1e-3);

    const targetBefore = worldTranslation(target);
    const pointer = ctx.input.pointer.primary;
    const point = (x: number): void => {
      pointer.position.value = [x, 0.5];
    };

    point(0.62);
    pointer.pressed.value = false;
    gizmo.sync(world);
    runner.step(1 / 60, 0.1);
    pointer.pressed.value = true;
    gizmo.sync(world);
    runner.step(1 / 60, 0.2);
    point(0.7);
    gizmo.sync(world);
    runner.step(1 / 60, 0.3);
    point(0.78);
    gizmo.sync(world);
    runner.step(1 / 60, 0.4);
    pointer.pressed.value = false;
    gizmo.sync(world);
    runner.step(1 / 60, 0.5);

    const targetAfter = worldTranslation(target);
    // Despite the 90°-rotated parent, the target moved along WORLD X only — proving
    // the world delta was converted through the parent inverse (without the fix the
    // motion would land on world Z).
    expect(targetAfter[0] - targetBefore[0]).toBeGreaterThan(0.2);
    expect(Math.abs(targetAfter[1] - targetBefore[1])).toBeLessThan(1e-3);
    expect(Math.abs(targetAfter[2] - targetBefore[2])).toBeLessThan(1e-3);
  });
});

describe("interaction pick layer mask (M7-T8 audit A1)", () => {
  it("scopes the built-in interaction pick via setPickLayerMask", async () => {
    const refs: CapturedRefs = { camera: null, target: null };
    const runner = await createRoute(refs, [0, 0, 5]);
    const ctx = runner.app.context;

    let entered = 0;
    ctx.interaction.onEnter(() => {
      entered += 1;
    });
    ctx.input.pointer.primary.position.value = [0.5, 0.5];

    // The target box is Pickable on the default layer (mask 0b01). Restricting the
    // interaction pick to bit 0b10 excludes it — no hover fires.
    ctx.interaction.setPickLayerMask(0b10);
    runner.step(1 / 60, 0);
    expect(entered).toBe(0);

    // Restoring the default (all layers) picks it again.
    ctx.interaction.setPickLayerMask(null);
    runner.step(1 / 60, 0.1);
    expect(entered).toBe(1);
  });
});
