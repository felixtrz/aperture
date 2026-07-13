import { expect, test, type Page } from "@playwright/test";

import { readPngImage, readPngImagePixel, type RgbaPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

// D2 (three.js parity plan, advanced-audit clipping row): an orthographic camera
// carries a world-space clip plane `(1, 0, 0, 0)` (keep world x >= 0). The box is
// SYMMETRIC about x = 0, so the only reason the left half renders as background
// (dark clear colour) while the right half is the opaque box colour is the clip
// plane discarding fragments with x < 0. A point that is opaque without clipping
// (left half of the box) becomes background once the plane is active. WebGPU core
// has no `clip_distances`, so the cut is a per-fragment discard.

interface ClippingCutawayStatus extends ExampleStatusBase {
  readonly clipPipelineKey?: string | null;
  readonly viewClipPlaneCount?: number;
  readonly samplePoints?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
}

test("browser cuts a primitive away with a camera clip plane", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/clipping-cutaway.html");

  const status = await waitForExampleStatus<ClippingCutawayStatus>(page);
  await attachExampleStatus("clipping-cutaway-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "clipping-cutaway",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  // The clip discard path compiled (the frame appended the `clip` feature token)
  // and the view genuinely carries a clip plane.
  expect(status.clipPipelineKey ?? "").toContain("clip");
  expect(status.viewClipPlaneCount ?? 0).toBe(1);

  await waitForPresentedFrames(page);
  const screenshot = await page
    .locator("#clipping-cutaway-canvas")
    .screenshot();
  await test.info().attach("clipping-cutaway-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);
  const samplePoints = status.samplePoints ?? [];
  const pixels = new Map<string, RgbaPixel>(
    samplePoints.map((point) => [
      point.id,
      readPngImagePixel(image, point.x, point.y),
    ]),
  );
  await test.info().attach("clipping-cutaway-pixels", {
    body: JSON.stringify([...pixels.entries()], null, 2),
    contentType: "application/json",
  });

  const keptBox = pixels.get("kept-box");
  const keptBox2 = pixels.get("kept-box-2");
  const clippedBg = pixels.get("clipped-bg");
  const clippedBg2 = pixels.get("clipped-bg-2");

  expect(keptBox, "kept-box sampled").toBeDefined();
  expect(clippedBg, "clipped-bg sampled").toBeDefined();

  // Kept half (world x >= 0): the opaque box is visible (bright, red-dominant).
  expect(keptBox?.r ?? 0).toBeGreaterThan(120);
  expect(keptBox?.r ?? 0).toBeGreaterThan((keptBox?.b ?? 255) + 40);
  expect(keptBox2?.r ?? 0).toBeGreaterThan(120);

  // Clipped half (world x < 0): the box is discarded -> dark background, NOT box.
  expect(clippedBg?.r ?? 255).toBeLessThan(90);
  expect(clippedBg2?.r ?? 255).toBeLessThan(90);

  // The plane genuinely cuts the symmetric box: far more red on the kept side
  // than the clipped side (without the plane the box would fill both halves).
  expect((keptBox?.r ?? 0) - (clippedBg?.r ?? 0)).toBeGreaterThan(60);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_CLIPPING_CUTAWAY_STOP__?: () => void;
      }
    ).__APERTURE_CLIPPING_CUTAWAY_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
