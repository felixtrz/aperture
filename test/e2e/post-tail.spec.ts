import { expect, test, type Page } from "@playwright/test";

import { readPngImage, type PngImage } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface PostTailFrameStatus {
  readonly ok: boolean;
  readonly postEffects: readonly {
    readonly effectId: string;
    readonly output: string;
    readonly ok: boolean;
    readonly drawCalls: number;
  }[];
  readonly motionVectors: { readonly status: string } | null;
  readonly outline: {
    readonly selection: number;
    readonly maskDrawCalls: number;
    readonly ok: boolean;
  } | null;
  readonly boundaries: number;
}

interface PostTailStatus extends ExampleStatusBase {
  readonly frames?: number;
  readonly outlineSelected?: boolean;
  readonly selection?: { readonly hasTarget: boolean; readonly count: number };
  readonly raw?: PostTailFrameStatus;
  readonly mb?: PostTailFrameStatus;
  readonly lut?: PostTailFrameStatus;
  readonly outline?: PostTailFrameStatus;
}

const CANVAS = 256;

test("post-processing tail: outline-from-selection, motion blur, and LUT grade", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/examples/post-tail.html");

  const status = await waitForExampleStatus<PostTailStatus>(page);
  await attachExampleStatus("post-tail-status", status);
  expect(status, "post-tail status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  try {
    expectStatusJsonSafeForGpu(status);

    // AC1: each new effect slots into the ordered post array with its per-effect
    // frame-report diagnostics present and non-zero when enabled.
    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "post-tail",
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu-explicit",
      outlineSelected: true,
      selection: { hasTarget: true, count: 1 },
      mb: {
        ok: true,
        postEffects: [
          { effectId: "motion-blur", output: "swapchain", ok: true },
        ],
        motionVectors: { status: "scene-attachment" },
      },
      lut: {
        ok: true,
        postEffects: [{ effectId: "lut", output: "swapchain", ok: true }],
      },
      outline: {
        ok: true,
        postEffects: [{ effectId: "outline", output: "swapchain", ok: true }],
        outline: { selection: 1, ok: true },
      },
    });
    expect(status.mb?.postEffects[0]?.drawCalls ?? 0).toBeGreaterThan(0);
    expect(status.lut?.postEffects[0]?.drawCalls ?? 0).toBeGreaterThan(0);
    expect(status.outline?.outline?.maskDrawCalls ?? 0).toBeGreaterThan(0);

    await waitForPresentedFrames(page, 10);

    const raw = await screenshotCanvas(page, "#post-tail-canvas-raw");
    const mb = await screenshotCanvas(page, "#post-tail-canvas-mb");
    const lut = await screenshotCanvas(page, "#post-tail-canvas-lut");
    const outlineSelected = await screenshotCanvas(
      page,
      "#post-tail-canvas-outline",
    );

    // AC1 (pixel proof) motion blur: the moving box is smeared, so the motion
    // blur pass differs from the raw pass around the mover.
    const motionDiff = countDifferentPixels(raw, mb, 40);
    // AC1 (pixel proof) LUT: the cool grade pushes scene pixels bluer than raw.
    const bluerPixels = countBluerPixels(raw, lut);

    // AC2 (pixel proof) outline: switch the selection off and re-render, then
    // compare — the only difference is the selected box's silhouette outline.
    await page.evaluate(() => {
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_POST_TAIL_SET_OUTLINE__?: (v: boolean) => void;
        }
      ).__APERTURE_POST_TAIL_SET_OUTLINE__?.(false);
    });
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                readonly __APERTURE_EXAMPLE_STATUS__?: PostTailStatus;
              }
            ).__APERTURE_EXAMPLE_STATUS__?.outlineSelected,
        ),
      )
      .toBe(false);
    await waitForPresentedFrames(page, 10);
    const outlineDeselected = await screenshotCanvas(
      page,
      "#post-tail-canvas-outline",
    );

    const deselectedStatus = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            readonly __APERTURE_EXAMPLE_STATUS__?: PostTailStatus;
          }
        ).__APERTURE_EXAMPLE_STATUS__,
    );

    const outlineWarmSelected = countWarmPixels(outlineSelected);
    const outlineWarmDeselected = countWarmPixels(outlineDeselected);
    const outlineDiff = countDifferentPixels(
      outlineSelected,
      outlineDeselected,
      50,
    );

    await test.info().attach("post-tail-metrics", {
      body: JSON.stringify(
        {
          motionDiff,
          bluerPixels,
          outlineWarmSelected,
          outlineWarmDeselected,
          outlineDiff,
          deselectedSelectionCount: deselectedStatus?.selection?.count,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await test.info().attach("post-tail-outline-selected", {
      body: outlineSelected.png,
      contentType: "image/png",
    });
    await test.info().attach("post-tail-outline-deselected", {
      body: outlineDeselected.png,
      contentType: "image/png",
    });

    // Motion blur changes the frame around the moving box.
    expect(
      motionDiff,
      `motion blur should smear the moving box; motionDiff=${motionDiff}`,
    ).toBeGreaterThan(40);
    // LUT color remap shifts a large fraction of the scene toward blue.
    expect(
      bluerPixels,
      `LUT grade should push scene pixels bluer; bluerPixels=${bluerPixels}`,
    ).toBeGreaterThan(400);
    // AC2: selecting the entity adds a warm outline ring; deselecting removes it.
    expect(
      outlineWarmSelected - outlineWarmDeselected,
      `outline should add warm silhouette pixels when selected; selected=${outlineWarmSelected} deselected=${outlineWarmDeselected}`,
    ).toBeGreaterThan(60);
    expect(
      outlineDiff,
      `outline select vs deselect must differ (the silhouette ring); diff=${outlineDiff}`,
    ).toBeGreaterThan(60);
    // AC2: the deselected frame drops the selection to zero.
    expect(deselectedStatus?.selection?.count ?? -1).toBe(0);

    webGpuValidation.expectNoWarnings();
  } finally {
    await stopRuntime(page);
  }
});

interface CanvasImage extends PngImage {
  readonly png: Buffer;
}

async function screenshotCanvas(
  page: Page,
  selector: string,
): Promise<CanvasImage> {
  const png = await page.locator(selector).screenshot();
  const image = cropToCanvas(readPngImage(png));
  return { ...image, png };
}

function cropToCanvas(image: PngImage): PngImage {
  expect(image.width).toBeGreaterThanOrEqual(CANVAS);
  expect(image.height).toBeGreaterThanOrEqual(CANVAS);
  expect(image.width).toBeLessThanOrEqual(CANVAS + 1);
  expect(image.height).toBeLessThanOrEqual(CANVAS + 1);

  if (image.width === CANVAS && image.height === CANVAS) {
    return image;
  }

  const rowBytes = CANVAS * image.bytesPerPixel;
  const sourceRowBytes = image.width * image.bytesPerPixel;
  const pixels = new Uint8Array(rowBytes * CANVAS);
  for (let y = 0; y < CANVAS; y += 1) {
    const sourceOffset = y * sourceRowBytes;
    pixels.set(
      image.pixels.subarray(sourceOffset, sourceOffset + rowBytes),
      y * rowBytes,
    );
  }
  return {
    width: CANVAS,
    height: CANVAS,
    bytesPerPixel: image.bytesPerPixel,
    pixels,
  };
}

function countDifferentPixels(
  a: PngImage,
  b: PngImage,
  threshold: number,
): number {
  const length = Math.min(a.pixels.length, b.pixels.length);
  let count = 0;
  for (let offset = 0; offset < length; offset += a.bytesPerPixel) {
    const dr = Math.abs((a.pixels[offset] ?? 0) - (b.pixels[offset] ?? 0));
    const dg = Math.abs(
      (a.pixels[offset + 1] ?? 0) - (b.pixels[offset + 1] ?? 0),
    );
    const db = Math.abs(
      (a.pixels[offset + 2] ?? 0) - (b.pixels[offset + 2] ?? 0),
    );
    if (dr + dg + db > threshold) {
      count += 1;
    }
  }
  return count;
}

function countBluerPixels(raw: PngImage, graded: PngImage): number {
  const length = Math.min(raw.pixels.length, graded.pixels.length);
  let count = 0;
  for (let offset = 0; offset < length; offset += raw.bytesPerPixel) {
    const rawB = raw.pixels[offset + 2] ?? 0;
    const gradedB = graded.pixels[offset + 2] ?? 0;
    const rawR = raw.pixels[offset] ?? 0;
    // Ignore the near-black background; only count lit scene pixels.
    const rawLuma =
      (raw.pixels[offset] ?? 0) + (raw.pixels[offset + 1] ?? 0) + rawB;
    if (
      rawLuma > 60 &&
      gradedB - rawB > 25 &&
      rawR > (graded.pixels[offset] ?? 0)
    ) {
      count += 1;
    }
  }
  return count;
}

// Warm/bright pixels distinctive of the orange outline ring. The delta between
// the selected and deselected frames isolates the ring from the (identically
// placed) red mover box, which is present in both.
function countWarmPixels(image: PngImage): number {
  let count = 0;
  for (
    let offset = 0;
    offset < image.pixels.length;
    offset += image.bytesPerPixel
  ) {
    const r = image.pixels[offset] ?? 0;
    const g = image.pixels[offset + 1] ?? 0;
    const b = image.pixels[offset + 2] ?? 0;
    if (r > 150 && g > 70 && r - b > 70) {
      count += 1;
    }
  }
  return count;
}

async function stopRuntime(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_POST_TAIL_STOP__?: () => void;
        }
      ).__APERTURE_POST_TAIL_STOP__?.();
    })
    .catch(() => {});
  await page.close({ runBeforeUnload: false }).catch(() => {});
}
