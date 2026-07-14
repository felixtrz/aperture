import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Pixel = readonly [number, number, number, number] | null;

interface ArcballStatus extends ExampleStatusBase {
  readonly transforms: {
    readonly eyeXBaseline: number | null;
    readonly eyeXAfterRotate: number | null;
    readonly eyeZBaseline: number | null;
    readonly eyeZAfterRotate: number | null;
    readonly distanceBaseline: number | null;
    readonly distanceAfterRotate: number | null;
    readonly distanceAfterZoom: number | null;
  };
  readonly pixels: {
    readonly rotateGridDelta: number;
    readonly zoomGridDelta: number;
    readonly coverageBaseline: number;
    readonly coverageAfterZoom: number;
    readonly baseline: Record<string, Pixel> | null;
    readonly afterRotate: Record<string, Pixel> | null;
    readonly afterZoom: Record<string, Pixel> | null;
  };
}

// H1 E2E: the arcball route renders an unlit box + a distinct side marker; a
// scripted Shoemake trackball drag orbits the eye off the +Z axis (the camera
// basis changes) so the marker sweeps across the readback grid while the orbit
// distance holds, and a scripted wheel zoom-in shrinks the distance and grows
// the box (coverage rises).
test("Playwright proves the arcball drag rotates the camera basis and zoom changes distance", async ({
  page,
}) => {
  await page.goto("/examples/arcball-camera.html");
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
  )) as ArcballStatus;

  await attachExampleStatus("arcball-camera-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "arcball-camera",
    ok: true,
    phase: "ready",
  });

  const t = status.transforms;
  expect(t.eyeXBaseline).not.toBeNull();
  // The eye starts on the +Z axis (X ≈ 0) and the trackball drag orbits it
  // toward +X — the camera basis rotated.
  expect(Math.abs(t.eyeXBaseline ?? 1)).toBeLessThan(0.05);
  expect(Math.abs(t.eyeXAfterRotate ?? 0)).toBeGreaterThan(1);
  // The pure rotation preserved the orbit distance.
  expect(
    Math.abs((t.distanceAfterRotate ?? 0) - (t.distanceBaseline ?? 0)),
  ).toBeLessThan(1e-2);
  // Zoom-in shrinks the orbit distance.
  expect(t.distanceAfterZoom ?? 0).toBeLessThan(
    (t.distanceBaseline ?? 0) - 0.5,
  );

  // The drag changed the rendered image (the side marker swept across the grid).
  expect(status.pixels.rotateGridDelta).toBeGreaterThan(80);
  // Zooming in grows the box on screen: coverage rises and the image changes.
  expect(status.pixels.zoomGridDelta).toBeGreaterThan(80);
  expect(status.pixels.coverageAfterZoom).toBeGreaterThan(
    status.pixels.coverageBaseline,
  );
});
