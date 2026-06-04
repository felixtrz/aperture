import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Vec3 = readonly [number, number, number] | null;

interface GizmoStatus extends ExampleStatusBase {
  readonly meshDraws: number;
  readonly drag: {
    readonly baselineTarget: Vec3;
    readonly afterDragTarget: Vec3;
    readonly baselineHandleX: Vec3;
    readonly afterDragHandleX: Vec3;
  };
}

// M7-T9 Done-when #3 (E2E gizmo route): a selected box + a translate gizmo render
// on the real GPU; a scripted pointer press + horizontal drag over the X handle
// translates the target along world X only (Y/Z unchanged) and the X handle follows.
test("Playwright proves dragging the X gizmo handle translates the target along world X", async ({
  page,
}) => {
  await page.goto("/examples/translate-gizmo.html");
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
  )) as GizmoStatus;

  await attachExampleStatus("translate-gizmo-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "translate-gizmo",
    ok: true,
    phase: "ready",
  });
  // The scene rendered (a real snapshot reached the GPU).
  expect(status.meshDraws).toBeGreaterThan(0);

  const d = status.drag;
  expect(d.baselineTarget).not.toBeNull();
  expect(d.afterDragTarget).not.toBeNull();
  const before = d.baselineTarget as readonly [number, number, number];
  const after = d.afterDragTarget as readonly [number, number, number];

  // Translated along world X only.
  expect(after[0] - before[0]).toBeGreaterThan(0.2);
  expect(Math.abs(after[1] - before[1])).toBeLessThan(1e-3);
  expect(Math.abs(after[2] - before[2])).toBeLessThan(1e-3);

  // The X handle followed the target (still offset by size/2 = 1.5 on world X).
  const handleBefore = d.baselineHandleX as readonly [number, number, number];
  const handleAfter = d.afterDragHandleX as readonly [number, number, number];
  expect(handleAfter[0] - handleBefore[0]).toBeCloseTo(after[0] - before[0], 3);
});
