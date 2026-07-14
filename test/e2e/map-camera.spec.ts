import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Pixel = readonly [number, number, number, number] | null;

interface MapStatus extends ExampleStatusBase {
  readonly transforms: {
    readonly targetXBaseline: number | null;
    readonly targetXAfterPan: number | null;
    readonly targetZBaseline: number | null;
    readonly targetZAfterPan: number | null;
    readonly eyeXBaseline: number | null;
    readonly eyeXAfterPan: number | null;
    readonly distanceBaseline: number | null;
    readonly distanceAfterPan: number | null;
    readonly distanceAfterZoom: number | null;
  };
  readonly pixels: {
    readonly panGridDelta: number;
    readonly zoomGridDelta: number;
    readonly coverageBaseline: number;
    readonly coverageAfterZoom: number;
    readonly baseline: Record<string, Pixel> | null;
    readonly afterPan: Record<string, Pixel> | null;
    readonly afterZoom: Record<string, Pixel> | null;
  };
}

// H1 E2E: the pan/map route renders an oblique camera over an unlit ground box +
// a distinct side marker; a scripted pan drag slides the target across the ground
// XZ plane (the eye follows by the same XZ delta while the distance holds) so the
// image changes, and a scripted wheel zoom-in dollies the eye toward the target
// (distance shrinks, box grows, coverage rises).
test("Playwright proves the map camera pans the target on XZ and zoom dollies the eye", async ({
  page,
}) => {
  await page.goto("/examples/map-camera.html");
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
  )) as MapStatus;

  await attachExampleStatus("map-camera-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "map-camera",
    ok: true,
    phase: "ready",
  });

  const t = status.transforms;
  expect(t.targetXBaseline).not.toBeNull();
  // The pan slid the target across the ground X axis.
  const targetDeltaX = (t.targetXAfterPan ?? 0) - (t.targetXBaseline ?? 0);
  expect(Math.abs(targetDeltaX)).toBeGreaterThan(0.3);
  // The eye followed the pan by the same XZ delta (distance held during pan).
  const eyeDeltaX = (t.eyeXAfterPan ?? 0) - (t.eyeXBaseline ?? 0);
  expect(Math.abs(eyeDeltaX - targetDeltaX)).toBeLessThan(1e-3);
  expect(
    Math.abs((t.distanceAfterPan ?? 0) - (t.distanceBaseline ?? 0)),
  ).toBeLessThan(1e-3);
  // Zoom-in shrinks the eye-to-target distance.
  expect(t.distanceAfterZoom ?? 0).toBeLessThan(
    (t.distanceBaseline ?? 0) - 0.5,
  );

  // Panning changed the rendered image (the ground box swept across the grid).
  expect(status.pixels.panGridDelta).toBeGreaterThan(80);
  // Zooming in grows the box on screen: coverage rises and the image changes.
  expect(status.pixels.zoomGridDelta).toBeGreaterThan(80);
  expect(status.pixels.coverageAfterZoom).toBeGreaterThan(
    status.pixels.coverageBaseline,
  );
});
