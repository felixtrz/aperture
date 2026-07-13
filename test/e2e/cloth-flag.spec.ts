import { expect, test, type Page } from "@playwright/test";

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

// D5 (three.js parity plan): first-class dynamic mesh API. The worker deforms a
// CPU cloth flag every frame with meshes.update(...); this spec proves (1) the
// flag visibly deforms between two captures, and (2) the frame report shows a
// stream of PARTIAL uploads — the dynamic-mesh upload byte counter increments
// each frame by the moving-window size (well below a full re-realization) with
// no asset re-registration, sustained across many frames.

interface ClothUploadStatus {
  readonly frameBytes: number;
  readonly frameFullBytes: number;
  readonly frameWrites: number;
  readonly frameUpdates: number;
  readonly partial: boolean;
  readonly totalUpdates: number;
  readonly totalBytes: number;
}

interface ClothFlagStatus extends ExampleStatusBase {
  readonly expectedMeshDraws: number;
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly expectedFrameBytes: number;
  readonly fullUploadBytes: number;
  readonly partialUpload: boolean;
  readonly upload: ClothUploadStatus | null;
  readonly frameOk: boolean | null;
}

// The flag (red, base color ~[0.86, 0.16, 0.18]) hangs in the center of the
// frame against a dark blue clear color, so a flag pixel reads high-red /
// low-blue. Sample a grid across its screen footprint.
const FLAG_REGION = {
  minX: 0.34,
  maxX: 0.66,
  minY: 0.32,
  maxY: 0.74,
} as const;
const FLAG_SCAN_STEP = 0.02;
const MOTION_PIXEL_THRESHOLD = 24;

function readStatus(page: Page) {
  return page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__?: ClothFlagStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

test("cloth flag deforms per frame via partial meshes.update uploads", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/cloth-flag.html");
  const initialStatus = await waitForExampleStatus<ClothFlagStatus>(page);

  expect(initialStatus, "cloth-flag status should publish").toBeDefined();

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
              readonly __APERTURE_EXAMPLE_STATUS__?: { readonly ok?: boolean };
            }
          ).__APERTURE_EXAMPLE_STATUS__;
          return status?.ok === true;
        }),
      { timeout: 30000 },
    )
    .toBe(true);

  const status = await readStatus(page);

  if (status === undefined) {
    throw new Error("cloth-flag status disappeared after becoming ok");
  }

  await attachExampleStatus("cloth-flag-status", status);
  expectStatusJsonSafeForGpu(status);

  // 1) The example is live and the flag renders.
  expect(status).toMatchObject({
    example: "cloth-flag",
    ok: true,
    frameOk: true,
    meshDraws: 1,
    partialUpload: true,
  });
  expect(status.drawCalls).toBeGreaterThan(0);

  // 2) The upload is PARTIAL, not a full re-realization: the report's
  // dynamic-mesh upload byte counter increments each frame by exactly the
  // moving-row window size, strictly below a full vertex+index re-upload.
  const upload = status.upload;
  expect(
    upload,
    "the report should carry dynamic-mesh upload counters",
  ).not.toBeNull();

  if (upload === null) {
    return;
  }

  expect(upload.partial).toBe(true);
  expect(upload.frameBytes).toBe(status.expectedFrameBytes);
  expect(upload.frameFullBytes).toBe(status.fullUploadBytes);
  expect(
    upload.frameBytes,
    "the per-frame upload must be smaller than a full re-realization",
  ).toBeLessThan(upload.frameFullBytes);
  // One contiguous vertex window per frame; the index buffer is skipped.
  expect(upload.frameWrites).toBe(1);
  expect(upload.frameUpdates).toBe(1);

  // 3) The flag is visible (red pixels present in its screen footprint).
  await waitForPresentedFrames(page, 6);
  const firstCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("cloth-flag-first.png", {
    body: firstCapture,
    contentType: "image/png",
  });

  const firstImage = readPngImage(firstCapture);
  let redPixels = 0;

  for (let y = FLAG_REGION.minY; y <= FLAG_REGION.maxY; y += FLAG_SCAN_STEP) {
    for (let x = FLAG_REGION.minX; x <= FLAG_REGION.maxX; x += FLAG_SCAN_STEP) {
      const pixel = readPngImagePixel(firstImage, x, y);
      if (pixel.r > 90 && pixel.r > pixel.b + 30) {
        redPixels += 1;
      }
    }
  }

  expect(
    redPixels,
    "the red flag should fill part of the frame",
  ).toBeGreaterThan(10);

  // 4) The flag DEFORMS: as the CPU cloth waves, lit pixels over its surface
  // change between two captures separated by many frames.
  const beforeUpdates = upload.totalUpdates;

  await waitForPresentedFrames(page, 40);
  const secondCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("cloth-flag-second.png", {
    body: secondCapture,
    contentType: "image/png",
  });

  const secondImage = readPngImage(secondCapture);
  let changedPixels = 0;

  for (let y = FLAG_REGION.minY; y <= FLAG_REGION.maxY; y += FLAG_SCAN_STEP) {
    for (let x = FLAG_REGION.minX; x <= FLAG_REGION.maxX; x += FLAG_SCAN_STEP) {
      const before = readPngImagePixel(firstImage, x, y);
      const after = readPngImagePixel(secondImage, x, y);
      if (pixelDistance(before, after) > MOTION_PIXEL_THRESHOLD) {
        changedPixels += 1;
      }
    }
  }

  expect(
    changedPixels,
    "cloth pixels should change frame to frame as it deforms",
  ).toBeGreaterThan(0);

  // 5) The partial uploads are SUSTAINED with no full re-registration: the
  // cumulative update count climbs by many across the observed frames while
  // every observed frame stays at the same partial byte size.
  const laterStatus = await readStatus(page);

  if (laterStatus === undefined || laterStatus.upload === null) {
    throw new Error("cloth-flag upload counters disappeared");
  }

  await attachExampleStatus("cloth-flag-later", laterStatus);
  expect(
    laterStatus.upload.totalUpdates - beforeUpdates,
    "many partial uploads should accumulate across the observed frames",
  ).toBeGreaterThan(20);
  expect(
    laterStatus.upload.frameBytes,
    "every frame stays at the same partial upload size (no full re-upload)",
  ).toBe(status.expectedFrameBytes);
  expect(laterStatus.upload.partial).toBe(true);

  // 6) Poll a run of frames and confirm the per-frame upload NEVER jumps to the
  // full-buffer size — a full re-realization would report frameBytes ==
  // fullUploadBytes.
  for (let sample = 0; sample < 8; sample += 1) {
    await waitForPresentedFrames(page, 3);
    const sampled = await readStatus(page);
    const sampledUpload = sampled?.upload ?? null;
    expect(sampledUpload).not.toBeNull();
    if (sampledUpload !== null) {
      expect(sampledUpload.frameBytes).toBe(status.expectedFrameBytes);
      expect(sampledUpload.frameBytes).toBeLessThan(status.fullUploadBytes);
      expect(sampledUpload.partial).toBe(true);
    }
  }

  webGpuValidation.expectNoWarnings();
});
