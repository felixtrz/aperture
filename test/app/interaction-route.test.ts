import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { Pickable, createPickable } from "@aperture-engine/render";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { EcsEntityRef } from "@aperture-engine/app/config";

// M7-T8 Done-when #1/#2 (render-control, headless): a route spawns a Pickable mesh;
// forwarding the pointer over it fires exactly one enter, off fires one leave; a
// down+up over it fires one click (with the entity ref + world point); a
// down+move-past-threshold+up fires dragStart/drag/dragEnd and NOT click.

interface InteractionCounts {
  enter: number;
  leave: number;
  down: number;
  up: number;
  click: number;
  dragStart: number;
  drag: number;
  dragEnd: number;
  targetRef: EcsEntityRef | null;
  clickEntity: EcsEntityRef | null;
  clickPoint: readonly [number, number, number] | null;
}

function createCounts(): InteractionCounts {
  return {
    enter: 0,
    leave: 0,
    down: 0,
    up: 0,
    click: 0,
    dragStart: 0,
    drag: 0,
    dragEnd: 0,
    targetRef: null,
    clickEntity: null,
    clickPoint: null,
  };
}

function routeSystem(counts: InteractionCounts): ApertureSystemModule {
  return {
    default: class InteractionRouteSystem extends createSystem({
      priority: 0,
    }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        const target = this.spawn.mesh({
          key: "target",
          mesh: mesh.box({ size: [2, 2, 2] }),
          material: material.standard(),
          transform: { translation: [0, 0, 0] },
        });
        target.addComponent(Pickable, createPickable({ enabled: true }));
        counts.targetRef = {
          index: target.index,
          generation: target.generation,
        };

        this.interaction.onEnter(() => {
          counts.enter += 1;
        });
        this.interaction.onLeave(() => {
          counts.leave += 1;
        });
        this.interaction.onDown(() => {
          counts.down += 1;
        });
        this.interaction.onUp(() => {
          counts.up += 1;
        });
        this.interaction.onClick((event) => {
          counts.click += 1;
          counts.clickEntity = event.entity;
          counts.clickPoint = event.point ?? null;
        });
        this.interaction.onDrag((event) => {
          if (event.type === "dragStart") counts.dragStart += 1;
          else if (event.type === "drag") counts.drag += 1;
          else if (event.type === "dragEnd") counts.dragEnd += 1;
        });
      }
    },
  };
}

async function createRoute(
  counts: InteractionCounts,
): Promise<ApertureHeadlessRunner> {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [routeSystem(counts)],
  });
}

function point(
  runner: ApertureHeadlessRunner,
  position: readonly [number, number],
): void {
  runner.enqueueInput({ kind: "pointer", pointer: "primary", position });
}

function press(runner: ApertureHeadlessRunner, pressed: boolean): void {
  runner.enqueueInput({ kind: "pointer", pointer: "primary", pressed });
}

describe("pointer interaction route (M7-T8)", () => {
  it("fires exactly one enter over the mesh and one leave off it", async () => {
    const counts = createCounts();
    const runner = await createRoute(counts);

    point(runner, [0.5, 0.5]);
    runner.step(1 / 60, 0);
    expect(counts.enter).toBe(1);
    expect(counts.leave).toBe(0);

    // Still over the mesh -> no re-enter.
    runner.step(1 / 60, 0.1);
    expect(counts.enter).toBe(1);

    // Off the mesh -> exactly one leave.
    point(runner, [0.5, 0.97]);
    runner.step(1 / 60, 0.2);
    expect(counts.leave).toBe(1);
    expect(counts.enter).toBe(1);
    expect(runner.app.context.interaction.hoveredEntity()).toBeNull();
  });

  it("fires one click for a press+release over the same entity", async () => {
    const counts = createCounts();
    const runner = await createRoute(counts);

    point(runner, [0.5, 0.5]);
    press(runner, false);
    runner.step(1 / 60, 0);

    press(runner, true);
    runner.step(1 / 60, 0.1);
    expect(counts.down).toBe(1);

    press(runner, false);
    runner.step(1 / 60, 0.2);
    expect(counts.up).toBe(1);
    expect(counts.click).toBe(1);
    expect(counts.dragStart).toBe(0);
    expect(counts.clickEntity).toEqual(counts.targetRef);
    expect(counts.clickPoint).not.toBeNull();
  });

  it("fires one click when a press+release pair collapses into a single frame", async () => {
    const counts = createCounts();
    const runner = await createRoute(counts);

    point(runner, [0.5, 0.5]);
    runner.step(1 / 60, 0);

    // A slow frame drains the full down+up pair in one advance: the
    // end-of-frame pressed sample stays false and only the reset-frame edge
    // signals witness the press. The interaction frame must still click.
    runner.enqueueInputBatch([
      { kind: "pointer", pointer: "primary", pressed: true },
      { kind: "pointer", pointer: "primary", pressed: false },
    ]);
    runner.step(1 / 60, 0.1);
    expect(runner.app.context.input.pointer.primary.pressed.value).toBe(false);
    expect(
      runner.app.context.input.pointer.primary.pressedThisFrame.value,
    ).toBe(true);

    expect(counts.down).toBe(1);
    expect(counts.up).toBe(1);
    expect(counts.click).toBe(1);
    expect(counts.dragStart).toBe(0);
    expect(counts.clickEntity).toEqual(counts.targetRef);
  });

  it("fires dragStart/drag/dragEnd (and NOT click) for a press+drag+release", async () => {
    const counts = createCounts();
    const runner = await createRoute(counts);

    point(runner, [0.5, 0.5]);
    press(runner, false);
    runner.step(1 / 60, 0);

    press(runner, true);
    runner.step(1 / 60, 0.1);

    // Move well past the drag threshold while staying over the mesh.
    point(runner, [0.62, 0.5]);
    runner.step(1 / 60, 0.2);
    expect(counts.dragStart).toBe(1);
    expect(counts.drag).toBeGreaterThanOrEqual(1);

    press(runner, false);
    runner.step(1 / 60, 0.3);
    expect(counts.dragEnd).toBe(1);
    expect(counts.click).toBe(0);
  });
});
