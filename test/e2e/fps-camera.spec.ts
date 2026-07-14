import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";

type Pixel = readonly [number, number, number, number] | null;

interface FpsStatus extends ExampleStatusBase {
  readonly transforms: {
    readonly yawBaseline: number | null;
    readonly yawAfterLook: number | null;
    readonly pitchBaseline: number | null;
    readonly posBaseline: readonly number[] | null;
    readonly posAfterMove: readonly number[] | null;
    readonly posYBaseline: number | null;
    readonly posYAfterMove: number | null;
    readonly horizontalMove: number;
  };
  readonly pixels: {
    readonly lookGridDelta: number;
    readonly moveGridDelta: number;
    readonly coverageBaseline: number;
    readonly coverageAfterMove: number;
    readonly baseline: Record<string, Pixel> | null;
    readonly afterLook: Record<string, Pixel> | null;
    readonly afterMove: Record<string, Pixel> | null;
  };
}

// H1 E2E: the pointer-lock FPS route renders an unlit box + a distinct side
// marker; a scripted pointer-lock look-turn changes the yaw so the marker sweeps
// across the readback grid, and a scripted WASD forward walk translates the eye
// along the LEVEL forward (Y unchanged — ground-constrained) so the rendered
// image changes again.
test("Playwright proves pointer-lock look turns the FPS camera and a level walk moves it", async ({
  page,
}) => {
  await page.goto("/examples/fps-camera.html");
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
  )) as FpsStatus;

  await attachExampleStatus("fps-camera-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "fps-camera",
    ok: true,
    phase: "ready",
  });

  const t = status.transforms;
  expect(t.yawBaseline).not.toBeNull();
  // The pointer-lock look-turn changed the yaw.
  expect(
    Math.abs((t.yawAfterLook ?? 0) - (t.yawBaseline ?? 0)),
  ).toBeGreaterThan(0.3);
  // The forward walk translated the eye (ground-constrained: Y unchanged).
  expect(t.horizontalMove).toBeGreaterThan(1);
  expect(Math.abs((t.posYAfterMove ?? 1) - (t.posYBaseline ?? 0))).toBeLessThan(
    1e-6,
  );

  // The turn changed the rendered image (the marker swept across the grid).
  expect(status.pixels.lookGridDelta).toBeGreaterThan(80);
  // The walk changed the rendered image again.
  expect(status.pixels.moveGridDelta).toBeGreaterThan(80);
});
