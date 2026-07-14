import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Vec3 = readonly [number, number, number] | null;

interface ScaleGizmoStatus extends ExampleStatusBase {
  readonly meshDraws: number;
  readonly drag: {
    readonly baselineScale: Vec3;
    readonly afterDragScale: Vec3;
  };
}

// H2 (E2E scale-gizmo route): a selected box + a scale gizmo render on the real
// GPU; a scripted pointer press + horizontal drag over the +X handle scales the
// target along world X only, snapped to a multiple of 0.5 (Y/Z unchanged).
test("Playwright proves dragging the X scale handle scales the target along world X, snapped", async ({
  page,
}) => {
  await page.goto("/examples/scale-gizmo.html");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          __APERTURE_EXAMPLE_STATUS__?: { phase?: string; ok?: boolean };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      return (
        status !== undefined &&
        (status.phase === "ready" || status.ok === false)
      );
    },
    undefined,
    { timeout: 30000 },
  );
  const status = (await page.evaluate(
    () =>
      (globalThis as { __APERTURE_EXAMPLE_STATUS__?: unknown })
        .__APERTURE_EXAMPLE_STATUS__,
  )) as ScaleGizmoStatus;

  await attachExampleStatus("scale-gizmo-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "scale-gizmo",
    ok: true,
    phase: "ready",
  });
  // The scene rendered (a real snapshot reached the GPU).
  expect(status.meshDraws).toBeGreaterThan(0);

  const d = status.drag;
  expect(d.baselineScale).not.toBeNull();
  expect(d.afterDragScale).not.toBeNull();
  const before = d.baselineScale as readonly [number, number, number];
  const after = d.afterDragScale as readonly [number, number, number];

  // Started at unit scale.
  expect(before[0]).toBeCloseTo(1, 5);
  expect(before[1]).toBeCloseTo(1, 5);
  expect(before[2]).toBeCloseTo(1, 5);

  // Scaled along world X only, and snapped to a multiple of 0.5.
  expect(after[0] - before[0]).toBeGreaterThan(0.2);
  const snapUnits = after[0] / 0.5;
  expect(Math.abs(snapUnits - Math.round(snapUnits))).toBeLessThan(1e-3);
  expect(Math.abs(after[1] - before[1])).toBeLessThan(1e-3);
  expect(Math.abs(after[2] - before[2])).toBeLessThan(1e-3);
});
