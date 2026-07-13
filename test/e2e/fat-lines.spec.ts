import { expect, test, type Page } from "@playwright/test";

import { readPngImage, type PngImage, type RgbaPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface LineReport {
  readonly lines?: number;
  readonly segments?: number;
  readonly drawnSegments?: number;
}

interface FatLinesStatus extends ExampleStatusBase {
  readonly lineReport?: LineReport | null;
  readonly cyanWidthPx?: number;
  readonly lineDiagnostics?: readonly string[];
  readonly samplePoints?: {
    readonly cyanColumnX: number;
    readonly cyanY: number;
    readonly amberRowY: number;
    readonly backgroundX: number;
    readonly backgroundY: number;
  };
}

function pixelAt(image: PngImage, x: number, y: number): RgbaPixel {
  const cx = Math.max(0, Math.min(image.width - 1, x));
  const cy = Math.max(0, Math.min(image.height - 1, y));
  const offset = (cy * image.width + cx) * image.bytesPerPixel;
  return {
    r: image.pixels[offset] ?? 0,
    g: image.pixels[offset + 1] ?? 0,
    b: image.pixels[offset + 2] ?? 0,
    a: image.bytesPerPixel === 4 ? (image.pixels[offset + 3] ?? 0) : 255,
  };
}

// Bright cyan line: low red, high green + blue.
function isCyan(p: RgbaPixel): boolean {
  return p.r < 130 && p.g > 120 && p.b > 120;
}

// Amber dashed line: high red + green, low blue.
function isAmber(p: RgbaPixel): boolean {
  return p.r > 150 && p.g > 90 && p.b < 130;
}

function isBackground(p: RgbaPixel): boolean {
  return p.r < 100 && p.g < 100 && p.b < 120;
}

// E1: the fat-line subsystem draws each polyline segment as a screen-space-width
// quad (Line2-style). This asserts the cyan line renders a pixel band far wider
// than a 1px GPU line (width band scale-invariant vs the canvas height) and that
// the amber line renders world-continuous dashes (a background gap between
// dashes).
test("browser draws screen-space-width fat lines with dashes", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/fat-lines.html");

  const status = await waitForExampleStatus<FatLinesStatus>(page);
  await attachExampleStatus("fat-lines-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "fat-lines",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  // Draw-count proof straight from the frame report: two polylines, four
  // segments (cyan staple = 3 segments, amber = 1).
  const report = status.lineReport ?? {};
  expect(report.lines).toBe(2);
  expect(report.segments).toBe(4);
  expect(report.drawnSegments).toBe(4);
  expect(status.lineDiagnostics ?? []).toEqual([]);

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#fat-lines-canvas").screenshot();
  await test.info().attach("fat-lines-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);
  const samples = status.samplePoints;
  expect(samples, "sample points published").toBeDefined();

  if (samples === undefined) {
    return;
  }

  // Screen-space width band: scan a vertical column through the cyan top run and
  // measure the longest contiguous cyan run. A 1px line would occupy ~1/height
  // of the column; the fat line occupies a large fraction, proving the band is
  // far wider than 1px (and the ratio is invariant to the screenshot scale).
  const columnX = Math.round(samples.cyanColumnX * image.width);
  let bestRun = 0;
  let currentRun = 0;
  for (let y = 0; y < image.height; y += 1) {
    if (isCyan(pixelAt(image, columnX, y))) {
      currentRun += 1;
      bestRun = Math.max(bestRun, currentRun);
    } else {
      currentRun = 0;
    }
  }
  const bandRatio = bestRun / image.height;
  await test.info().attach("fat-lines-band", {
    body: JSON.stringify({ bestRun, height: image.height, bandRatio }, null, 2),
    contentType: "application/json",
  });
  expect(bestRun, "cyan band spans multiple pixels").toBeGreaterThanOrEqual(4);
  expect(
    bandRatio,
    "cyan band far exceeds a 1px line relative to canvas height",
  ).toBeGreaterThan(0.03);

  // Dashes: scan the amber row and confirm both amber (dash) and background
  // (gap) pixels appear, with at least one interior gap between dashes.
  const rowY = Math.round(samples.amberRowY * image.height);
  let firstAmber = -1;
  let lastAmber = -1;
  let amberCount = 0;
  for (let x = 0; x < image.width; x += 1) {
    if (isAmber(pixelAt(image, x, rowY))) {
      amberCount += 1;
      if (firstAmber === -1) {
        firstAmber = x;
      }
      lastAmber = x;
    }
  }
  let interiorGap = 0;
  for (let x = firstAmber; x <= lastAmber && firstAmber !== -1; x += 1) {
    if (isBackground(pixelAt(image, x, rowY))) {
      interiorGap += 1;
    }
  }
  await test.info().attach("fat-lines-dashes", {
    body: JSON.stringify(
      { amberCount, firstAmber, lastAmber, interiorGap },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(amberCount, "amber dashed line renders").toBeGreaterThan(4);
  expect(interiorGap, "a background gap separates the dashes").toBeGreaterThan(
    0,
  );

  // Background control between the lines stays dark.
  const background = pixelAt(
    image,
    Math.round(samples.backgroundX * image.width),
    Math.round(samples.backgroundY * image.height),
  );
  expect(isBackground(background), "control pixel is background").toBe(true);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_FAT_LINES_STOP__?: () => void;
      }
    ).__APERTURE_FAT_LINES_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
