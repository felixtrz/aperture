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

interface DynamicTextureEntryStatus {
  readonly id: string;
  readonly updates: number;
  readonly bytesUploaded: number;
  readonly externalImageUpdates: number;
  readonly failedUpdates: number;
}

interface RuntimeTextureStatus extends ExampleStatusBase {
  readonly uploadLoopStarted: boolean;
  readonly uploadFrame: number;
  readonly wallRect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly dynamicTextures: {
    readonly textureCount: number;
    readonly frameUpdates: number;
    readonly frameBytesUploaded: number;
    readonly totalUpdates: number;
    readonly totalBytesUploaded: number;
    readonly totalExternalImageUpdates: number;
    readonly totalFailedUpdates: number;
    readonly textures: readonly DynamicTextureEntryStatus[];
  } | null;
  readonly lastUpload: {
    readonly frame: number;
    readonly tickerMode: string;
    readonly tickerBytes: number;
  } | null;
  readonly frameOk: boolean | null;
}

// The animated TV region scrolls color bars every frame, so pixels inside the
// wall change color between captures. A grid scan over the wall rect makes the
// motion assertion robust to exact sample placement under SwiftShader.
const MOTION_SCAN_STEP = 0.01;
const MOTION_PIXEL_THRESHOLD = 30;

test("runtime texture updates (dynamic + video) change on-screen pixels between frames", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/runtime-texture.html");
  const initialStatus = await waitForExampleStatus<RuntimeTextureStatus>(page);

  expect(initialStatus, "runtime-texture status should publish").toBeDefined();

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
              readonly __APERTURE_EXAMPLE_STATUS__?: RuntimeTextureStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: RuntimeTextureStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("runtime-texture-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({ example: "runtime-texture", ok: true });

  // The frame report carries the dynamic-texture update counters.
  const dynamic = status.dynamicTextures;
  expect(
    dynamic,
    "frame report should carry dynamic-texture counters",
  ).not.toBeNull();

  if (dynamic === null) {
    return;
  }

  expect(dynamic.textureCount, "one dynamic texture atlas").toBe(1);
  expect(
    dynamic.totalUpdates,
    "runtime updates should have been applied",
  ).toBeGreaterThan(0);
  expect(
    dynamic.totalBytesUploaded,
    "uploaded bytes should be reported",
  ).toBeGreaterThan(0);
  // AC2: the scoreboard + TV regions upload from a canvas via
  // copyExternalImageToTexture.
  expect(
    dynamic.totalExternalImageUpdates,
    "canvas/video external-image uploads should have run",
  ).toBeGreaterThan(0);
  // AC1: the ticker region uploads raw CPU bytes via writeTexture (the
  // non-external updates).
  expect(
    dynamic.totalUpdates - dynamic.totalExternalImageUpdates,
    "CPU-bytes writeTexture uploads should have run",
  ).toBeGreaterThan(0);
  expect(dynamic.totalFailedUpdates, "no update should have failed").toBe(0);

  const wall = status.wallRect;
  expect(wall, "the wall rect should be published").toBeDefined();

  await waitForPresentedFrames(page, 8);
  const firstCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("runtime-texture-first.png", {
    body: firstCapture,
    contentType: "image/png",
  });

  const firstImage = readPngImage(firstCapture);

  // Control: the wall renders non-clear content (an uploaded texel, not the dark
  // background clear color).
  const wallCenter = readPngImagePixel(
    firstImage,
    wall.x + wall.width / 2,
    wall.y + wall.height / 2,
  );
  expect(
    wallCenter.r + wallCenter.g + wallCenter.b,
    "the video wall should show uploaded (non-clear) content",
  ).toBeGreaterThan(60);

  // The runtime updates are LIVE: as the animated canvas scrolls, pixels inside
  // the wall change between captures — the core proof of a runtime update.
  await waitForPresentedFrames(page, 30);
  const secondCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("runtime-texture-second.png", {
    body: secondCapture,
    contentType: "image/png",
  });

  const secondImage = readPngImage(secondCapture);
  let changedPixels = 0;

  const minX = wall.x;
  const maxX = wall.x + wall.width;
  const minY = wall.y;
  const maxY = wall.y + wall.height;

  for (let y = minY; y <= maxY; y += MOTION_SCAN_STEP) {
    for (let x = minX; x <= maxX; x += MOTION_SCAN_STEP) {
      const before = readPngImagePixel(firstImage, x, y);
      const after = readPngImagePixel(secondImage, x, y);

      if (pixelDistance(before, after) > MOTION_PIXEL_THRESHOLD) {
        changedPixels += 1;
      }
    }
  }

  expect(
    changedPixels,
    "wall pixels should change as the runtime-updated texture animates",
  ).toBeGreaterThan(0);

  webGpuValidation.expectNoWarnings();
});
