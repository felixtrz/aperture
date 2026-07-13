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

// D1 (three.js parity plan, advanced-audit scenario #8 / halves #7): a base
// mesh writes stencil = 1 over its silhouette, then a scaled-up copy is drawn
// ONLY where stencil != 1, leaving an orange outline halo around the blue base.
// The center is the base (BLUE), the halo above/below the base is the outline
// (ORANGE), and the corners are outside the enlarged copy (dark clear). Without
// stencil the orange copy would cover the blue center, so blue-center /
// orange-halo isolates the stencil test.

interface StencilOutlineStatus extends ExampleStatusBase {
  readonly stencilPipelineKey?: string | null;
  readonly depthAttachmentFormat?: string | null;
  readonly samplePoints?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
}

test("browser draws a stencil outline halo around a mesh", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/stencil-outline.html");

  const status = await waitForExampleStatus<StencilOutlineStatus>(page);
  await attachExampleStatus("stencil-outline-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "stencil-outline",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  expect(status.stencilPipelineKey ?? "").toContain("stencil:");
  expect(status.depthAttachmentFormat).toBe("depth24plus-stencil8");

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#stencil-outline-canvas").screenshot();
  await test.info().attach("stencil-outline-canvas", {
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
  await test.info().attach("stencil-outline-pixels", {
    body: JSON.stringify([...pixels.entries()], null, 2),
    contentType: "application/json",
  });

  const base = pixels.get("base-center");
  const outlineTop = pixels.get("outline-top");
  const outlineBottom = pixels.get("outline-bottom");
  const corner = pixels.get("background-corner");

  expect(base, "base-center sampled").toBeDefined();
  expect(outlineTop, "outline-top sampled").toBeDefined();

  // Center: the base mesh, BLUE (blue dominates, not orange).
  expect(base?.b ?? 0).toBeGreaterThan(120);
  expect(base?.b ?? 0).toBeGreaterThan(base?.r ?? 255);

  // Halo: the outline, ORANGE (strong red, little blue) — proving the scaled
  // copy is masked to the ring where the base did NOT write stencil.
  expect(outlineTop?.r ?? 0).toBeGreaterThan(150);
  expect(outlineTop?.r ?? 0).toBeGreaterThan(outlineTop?.b ?? 255);
  expect(outlineBottom?.r ?? 0).toBeGreaterThan(150);
  expect(outlineBottom?.r ?? 0).toBeGreaterThan(outlineBottom?.b ?? 255);

  // The base interior is NOT overwritten by the orange copy (stencil masked it).
  expect(base?.r ?? 255).toBeLessThan(outlineTop?.r ?? 0);

  // Corners are outside the enlarged copy -> dark clear colour (no orange).
  expect(corner?.r ?? 255).toBeLessThan(90);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_STENCIL_OUTLINE_STOP__?: () => void;
      }
    ).__APERTURE_STENCIL_OUTLINE_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
