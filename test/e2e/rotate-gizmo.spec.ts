import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Quat = readonly [number, number, number, number] | null;

interface RotateGizmoStatus extends ExampleStatusBase {
  readonly meshDraws: number;
  readonly drag: {
    readonly baselineRotation: Quat;
    readonly afterDragRotation: Quat;
  };
}

// H2 (E2E rotate-gizmo route): a selected box + a rotate gizmo render on the real
// GPU; a scripted pointer press + arc drag over the +Z ring rotates the target
// about world Z only, snapped to π/4 (the perpendicular X/Y quaternion components
// stay ~0).
test("Playwright proves dragging the +Z rotate ring rotates the target about world Z, snapped", async ({
  page,
}) => {
  await page.goto("/examples/rotate-gizmo.html");
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
  )) as RotateGizmoStatus;

  await attachExampleStatus("rotate-gizmo-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "rotate-gizmo",
    ok: true,
    phase: "ready",
  });
  // The scene rendered (a real snapshot reached the GPU).
  expect(status.meshDraws).toBeGreaterThan(0);

  const d = status.drag;
  expect(d.baselineRotation).not.toBeNull();
  expect(d.afterDragRotation).not.toBeNull();
  const before = d.baselineRotation as readonly [
    number,
    number,
    number,
    number,
  ];
  const after = d.afterDragRotation as readonly [
    number,
    number,
    number,
    number,
  ];

  // Started unrotated.
  expect(Math.abs(before[2])).toBeLessThan(1e-6);
  expect(before[3]).toBeCloseTo(1, 6);

  // Rotated about world Z only: X/Y quaternion components stay ~0, and the
  // applied angle snapped to exactly π/4 (a positive, CCW sweep).
  expect(Math.abs(after[0])).toBeLessThan(1e-4);
  expect(Math.abs(after[1])).toBeLessThan(1e-4);
  expect(after[2]).toBeGreaterThan(0);
  const angle = 2 * Math.atan2(after[2], after[3]);
  expect(angle).toBeCloseTo(Math.PI / 4, 3);
});
