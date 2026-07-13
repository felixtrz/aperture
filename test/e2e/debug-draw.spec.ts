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

interface DebugDrawReport {
  readonly primitives?: number;
  readonly segments?: number;
  readonly vertices?: number;
}

interface OverlayReport {
  readonly segments?: number;
  readonly drawnSegments?: number;
}

interface DebugDrawStatus extends ExampleStatusBase {
  readonly debugDrawEnabled?: boolean;
  readonly overlayReport?: OverlayReport | null;
  readonly workerDebugReport?: DebugDrawReport | null;
  readonly expected?: {
    readonly primitives: number;
    readonly segments: number;
    readonly aabb: number;
    readonly sphere: number;
    readonly axes: number;
    readonly grid: number;
    readonly physics: number;
  };
  readonly samplePoints?: {
    readonly backgroundX: number;
    readonly backgroundY: number;
  };
  readonly debugDiagnostics?: readonly string[];
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

// Cyan AABB overlay: low red, high green + blue.
function isCyan(p: RgbaPixel): boolean {
  return p.r < 130 && p.g > 120 && p.b > 120;
}

// Orange physics-collider overlay: high red, warm green, low blue (distinct from
// the magenta sphere, whose blue is high, and the red axis, whose blue is mid).
function isOrange(p: RgbaPixel): boolean {
  return p.r > 200 && p.g > 140 && p.g < 230 && p.b < 130;
}

function isBackground(p: RgbaPixel): boolean {
  return p.r < 90 && p.g < 90 && p.b < 110;
}

function countPixels(
  image: PngImage,
  predicate: (p: RgbaPixel) => boolean,
): number {
  let count = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (predicate(pixelAt(image, x, y))) {
        count += 1;
      }
    }
  }
  return count;
}

// E3 (three.js parity plan, Box3/Sphere/Axes/Grid/Camera/Skeleton helpers as an
// immediate-mode debug-draw overlay): a system draws an AABB, wireframe sphere,
// axes, grid, and a physics collider wireframe every frame through
// `this.debugDraw`. This asserts, from the frame report, that the debug-primitive
// counts are exactly what the system drew (1 AABB -> 12 segments, etc.), that
// debug-colored overlay pixels appear over the scene, and — via ?debug=off —
// that disabling debug draw drops the counts to zero with no overlay pixels.
test("browser renders an immediate-mode debug-draw overlay with report-asserted primitive counts", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/debug-draw.html");

  const status = await waitForExampleStatus<DebugDrawStatus>(page);
  await attachExampleStatus("debug-draw-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "debug-draw",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    debugDrawEnabled: true,
  });
  expect(status.debugDiagnostics ?? []).toEqual([]);

  const expected = status.expected;
  expect(expected, "expected counts published").toBeDefined();

  if (expected === undefined) {
    return;
  }

  // Primitive-count proof straight from the extraction frame report: 5 debug
  // primitives tessellating into 89 segments (AABB 12 + sphere 48 + axes 3 +
  // grid 14 + physics 12).
  expect(expected.aabb).toBe(12);
  expect(expected.sphere).toBe(48);
  expect(expected.axes).toBe(3);
  expect(expected.grid).toBe(14);
  expect(expected.physics).toBe(12);
  expect(expected.segments).toBe(89);

  expect(status.workerDebugReport?.primitives).toBe(5);
  expect(status.workerDebugReport?.segments).toBe(89);
  expect(status.workerDebugReport?.vertices).toBe(178);
  // The renderer drew exactly the same segment count through the shared line
  // overlay pipeline.
  expect(status.overlayReport?.drawnSegments).toBe(89);

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#debug-draw-canvas").screenshot();
  await test.info().attach("debug-draw-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);

  // Overlay-pixel proof: the cyan AABB wireframe and the orange physics-collider
  // wireframe both composite over the dark scene.
  const cyanPixels = countPixels(image, isCyan);
  const orangePixels = countPixels(image, isOrange);
  await test.info().attach("debug-draw-pixels", {
    body: JSON.stringify({ cyanPixels, orangePixels }, null, 2),
    contentType: "application/json",
  });
  expect(cyanPixels, "cyan AABB overlay pixels present").toBeGreaterThan(4);
  expect(
    orangePixels,
    "orange physics collider overlay pixels present",
  ).toBeGreaterThan(4);

  const samples = status.samplePoints;
  if (samples !== undefined) {
    const background = pixelAt(
      image,
      Math.round(samples.backgroundX * image.width),
      Math.round(samples.backgroundY * image.height),
    );
    expect(isBackground(background), "control pixel is background").toBe(true);
  }

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_DEBUG_DRAW_STOP__?: () => void;
      }
    ).__APERTURE_DEBUG_DRAW_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

// Disabling debug draw (config.debugDraw: false, via ?debug=off) makes
// `this.debugDraw.*` a no-op: no overlay family, no report field, and zero
// overlay pixels — proving the "compiled out in production" contract.
test("browser drops debug-draw to zero when disabled", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/debug-draw.html?debug=off");

  const status = await waitForExampleStatus<DebugDrawStatus>(page);
  await attachExampleStatus("debug-draw-off-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "debug-draw",
    ok: true,
    debugDrawEnabled: false,
  });

  // The disabled overlay emits no debug family and no report field.
  expect(status.workerDebugReport ?? null).toBeNull();
  expect(status.overlayReport ?? null).toBeNull();

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#debug-draw-canvas").screenshot();
  await test.info().attach("debug-draw-off-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);
  expect(
    countPixels(image, isCyan),
    "no cyan overlay pixels when disabled",
  ).toBe(0);
  expect(
    countPixels(image, isOrange),
    "no orange overlay pixels when disabled",
  ).toBe(0);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_DEBUG_DRAW_STOP__?: () => void;
      }
    ).__APERTURE_DEBUG_DRAW_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
