import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Pixel = readonly [number, number, number, number] | null;

interface OrbitStatus extends ExampleStatusBase {
  readonly transforms: {
    readonly azimuthBaseline: number | null;
    readonly azimuthAfterOrbit: number | null;
    readonly distanceBaseline: number | null;
    readonly distanceAfterOrbit: number | null;
    readonly distanceAfterZoom: number | null;
  };
  readonly pixels: {
    readonly orbitGridDelta: number;
    readonly zoomGridDelta: number;
    readonly coverageBaseline: number;
    readonly coverageAfterZoom: number;
    readonly baseline: Record<string, Pixel> | null;
    readonly afterOrbit: Record<string, Pixel> | null;
    readonly afterZoom: Record<string, Pixel> | null;
  };
}

// M7-T9 Done-when #1/#2 (E2E pixel halves): the orbit route renders a lit box;
// a scripted horizontal pointer drag orbits the camera (two readbacks differ +
// azimuth changes while the target distance stays constant), and a scripted wheel
// zoom shrinks the camera-to-target distance and grows the box on screen.
test("Playwright proves orbit drag rotates the camera and zoom changes distance", async ({
  page,
}) => {
  await page.goto("/examples/orbit-camera.html");
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
  )) as OrbitStatus;

  await attachExampleStatus("orbit-camera-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "orbit-camera",
    ok: true,
    phase: "ready",
  });

  const t = status.transforms;
  expect(t.azimuthBaseline).not.toBeNull();
  // Orbit drag changed the azimuth.
  expect(
    Math.abs((t.azimuthAfterOrbit ?? 0) - (t.azimuthBaseline ?? 0)),
  ).toBeGreaterThan(0.3);
  // Orbiting preserves the distance to the target.
  expect(
    Math.abs((t.distanceAfterOrbit ?? 0) - (t.distanceBaseline ?? 0)),
  ).toBeLessThan(1e-3);
  // Zoom-in shrinks the camera-to-target distance.
  expect(t.distanceAfterZoom ?? 0).toBeLessThan(
    (t.distanceBaseline ?? 0) - 0.5,
  );

  // Two readbacks before/after the orbit differ (the rendered image changed as
  // the side marker swept across the view).
  expect(status.pixels.orbitGridDelta).toBeGreaterThan(150);
  // Zooming in grows the box on screen: more readback grid points land on it
  // (coverage rises) and the sampled image changes measurably.
  expect(status.pixels.zoomGridDelta).toBeGreaterThan(400);
  expect(status.pixels.coverageAfterZoom).toBeGreaterThan(
    status.pixels.coverageBaseline,
  );
});
