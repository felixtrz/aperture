import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

interface EntityRef {
  readonly index: number;
  readonly generation: number;
}

interface PointerEventsStatus extends ExampleStatusBase {
  readonly domListeners: boolean;
  readonly scene: {
    readonly target: EntityRef | null;
  };
  readonly interaction: {
    readonly counts: {
      readonly enter: number;
      readonly leave: number;
      readonly down: number;
      readonly up: number;
      readonly click: number;
      readonly dragStart: number;
      readonly drag: number;
      readonly dragEnd: number;
    };
    readonly hoveredEntity: EntityRef | null;
    readonly click: {
      readonly entity: EntityRef | null;
      readonly point: readonly [number, number, number] | null;
    };
  };
}

// M7-T8 Done-when #1/#2 (E2E): the pointer-events route spawns a Pickable mesh and
// drives the pointer over it; enter/leave fire exactly once per edge, a press+release
// over the same entity fires exactly one click (carrying the entity ref + world hit
// point), and a press+drag+release fires dragStart/drag/dragEnd and NOT a second click.
test("Playwright proves pointer-on-object enter/leave/click/drag events fire", async ({
  page,
}) => {
  await page.goto("/examples/pointer-events.html");
  const status = await waitForExampleStatus<PointerEventsStatus>(page);

  await attachExampleStatus("pointer-events-status", status);
  expect(status, "pointer-events status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "pointer-events",
    ok: true,
    phase: "ready",
    domListeners: false,
  });

  expect(status.scene.target).not.toBeNull();

  const { counts, hoveredEntity, click } = status.interaction;
  // Edge-triggered hover: on -> off -> back on across three frames.
  expect(counts.enter).toBe(2);
  expect(counts.leave).toBe(1);
  // One click (no drag), one drag gesture (no extra click).
  expect(counts.click).toBe(1);
  expect(counts.dragStart).toBe(1);
  expect(counts.dragEnd).toBe(1);
  expect(counts.drag).toBeGreaterThanOrEqual(1);
  // Pointer ends hovering the target after the drag.
  expect(hoveredEntity).toEqual(status.scene.target);
  // The click carries the hit entity ref + a world hit point.
  expect(click.entity).toEqual(status.scene.target);
  expect(click.point).not.toBeNull();
});
