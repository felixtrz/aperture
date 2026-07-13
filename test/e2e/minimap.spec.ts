import { expect, test } from "@playwright/test";

import { pixelDistance, readPngImage, readPngImagePixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MinimapStatus extends ExampleStatusBase {
  readonly expectedMeshDraws: number;
  readonly expectedViews: number;
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly views: number;
  readonly frameOk: boolean | null;
  readonly hudRect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

// The HUD quad covers normalized screen rect x [0.025, 0.325], y [0.03,
// 0.35] (published in the status as hudRect; the upper-LEFT corner — the
// example status panel floats over the canvas's upper-right). The static red
// corner box at world (-6, -6) is a deterministic minimap landmark: the
// overhead ortho camera is fixed (height 22 over a 22-unit map), so the box
// projects to minimap uv (0.227, 0.227) => screen (0.093, 0.103). The
// adjacent OUTSIDE sample sits at the same height in the main view, which
// shows the green arena ground there — nothing red.
const INSIDE_MINIMAP_LANDMARK = { x: 0.093, y: 0.103 } as const;
const INSIDE_MINIMAP_GROUND = { x: 0.17, y: 0.19 } as const;
const OUTSIDE_MINIMAP = { x: 0.45, y: 0.103 } as const;
const MAIN_VIEW_CONTROL = { x: 0.5, y: 0.7 } as const;

// Grid scan over the minimap corner for the motion assertion.
const MINIMAP_REGION = {
  minX: 0.04,
  maxX: 0.31,
  minY: 0.05,
  maxY: 0.33,
} as const;
const MOTION_SCAN_STEP = 0.01;
const MOTION_PIXEL_THRESHOLD = 30;

test("minimap renders a facade render target into a HUD corner that tracks the player", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/minimap.html");
  const initialStatus = await waitForExampleStatus<MinimapStatus>(page);

  expect(initialStatus, "minimap status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const status = (
            globalThis as {
              readonly __APERTURE_EXAMPLE_STATUS__?: MinimapStatus;
            }
          ).__APERTURE_EXAMPLE_STATUS__;

          return status?.ok === true;
        }),
      { timeout: 30000 },
    )
    .toBe(true);

  const status = await page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: MinimapStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("minimap-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "minimap",
    ok: true,
    frameOk: true,
    views: 2,
    meshDraws: 7,
  });
  expect(status.drawCalls).toBeGreaterThan(0);

  await waitForPresentedFrames(page, 6);
  const firstCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("minimap-first.png", {
    body: firstCapture,
    contentType: "image/png",
  });

  const firstImage = readPngImage(firstCapture);

  // 1) Control: the main view renders (non-clear center — the green arena
  // ground fills the lower half of the frame behind the player).
  const mainControl = readPngImagePixel(
    firstImage,
    MAIN_VIEW_CONTROL.x,
    MAIN_VIEW_CONTROL.y,
  );

  expect(
    mainControl.g,
    "main view should show the lit arena ground",
  ).toBeGreaterThan(40);

  // 2) The minimap corner shows the render target, not the main scene: the
  // red landmark box is visible at its fixed overhead-projection position
  // inside the HUD rect, clearly distinct from the adjacent main-view pixel
  // at the same height (green arena ground / background).
  const landmarkPixel = readPngImagePixel(
    firstImage,
    INSIDE_MINIMAP_LANDMARK.x,
    INSIDE_MINIMAP_LANDMARK.y,
  );
  const groundPixel = readPngImagePixel(
    firstImage,
    INSIDE_MINIMAP_GROUND.x,
    INSIDE_MINIMAP_GROUND.y,
  );
  const outsidePixel = readPngImagePixel(
    firstImage,
    OUTSIDE_MINIMAP.x,
    OUTSIDE_MINIMAP.y,
  );

  await attachExampleStatus("minimap-samples", {
    landmarkPixel,
    groundPixel,
    outsidePixel,
  });
  expect(
    pixelDistance(landmarkPixel, outsidePixel),
    "the HUD corner should contain minimap content distinct from the scene behind it",
  ).toBeGreaterThan(60);
  expect(
    landmarkPixel.r,
    "the red landmark box should appear at its overhead-projection position",
  ).toBeGreaterThan(landmarkPixel.g + 30);
  // The minimap interior shows the overhead arena (lit green ground).
  expect(
    groundPixel.g,
    "minimap should show the arena from above",
  ).toBeGreaterThan(50);

  // 3) The minimap is LIVE: as the player orbits, pixels inside the corner
  // change between captures (the white player dot moves across the map).
  await waitForPresentedFrames(page, 30);
  const secondCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("minimap-second.png", {
    body: secondCapture,
    contentType: "image/png",
  });

  const secondImage = readPngImage(secondCapture);
  let changedMinimapPixels = 0;

  for (
    let y = MINIMAP_REGION.minY;
    y <= MINIMAP_REGION.maxY;
    y += MOTION_SCAN_STEP
  ) {
    for (
      let x = MINIMAP_REGION.minX;
      x <= MINIMAP_REGION.maxX;
      x += MOTION_SCAN_STEP
    ) {
      const before = readPngImagePixel(firstImage, x, y);
      const after = readPngImagePixel(secondImage, x, y);

      if (pixelDistance(before, after) > MOTION_PIXEL_THRESHOLD) {
        changedMinimapPixels += 1;
      }
    }
  }

  expect(
    changedMinimapPixels,
    "minimap pixels should change as the player moves",
  ).toBeGreaterThan(0);

  webGpuValidation.expectNoWarnings();
});
