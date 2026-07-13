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

// D1 (three.js parity plan, advanced-audit scenario #8): a stencil MASK stamps
// a small centered portal region into the stencil buffer, then a full-view
// content quad is revealed ONLY where stencil == the mask reference. The center
// is inside the portal (bright GREEN content); the corners are masked out (dark
// clear colour). Without stencil the content would fill the whole view, so the
// green-center / dark-corner contrast isolates the stencil mask. The frame's
// depth attachment is auto-selected as depth24plus-stencil8.

interface StencilPortalStatus extends ExampleStatusBase {
  readonly stencilPipelineKey?: string | null;
  readonly depthAttachmentFormat?: string | null;
  readonly samplePoints?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
}

test("browser reveals a scene through a stencil portal mask", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/stencil-portal.html");

  const status = await waitForExampleStatus<StencilPortalStatus>(page);
  await attachExampleStatus("stencil-portal-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "stencil-portal",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  // The stencil material compiled + drew, and the frame selected a
  // stencil-capable depth attachment.
  expect(status.stencilPipelineKey ?? "").toContain("stencil:");
  expect(status.depthAttachmentFormat).toBe("depth24plus-stencil8");

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#stencil-portal-canvas").screenshot();
  await test.info().attach("stencil-portal-canvas", {
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
  await test.info().attach("stencil-portal-pixels", {
    body: JSON.stringify([...pixels.entries()], null, 2),
    contentType: "application/json",
  });

  const center = pixels.get("portal-center");
  const center2 = pixels.get("portal-center-2");
  const corner = pixels.get("masked-corner");
  const corner2 = pixels.get("masked-corner-2");

  expect(center, "portal-center sampled").toBeDefined();
  expect(corner, "masked-corner sampled").toBeDefined();

  // Inside the portal: the GREEN content is revealed (green dominates).
  expect(center?.g ?? 0).toBeGreaterThan(120);
  expect(center?.g ?? 0).toBeGreaterThan(center?.r ?? 255);
  expect(center2?.g ?? 0).toBeGreaterThan(120);

  // Outside the portal: content is masked out -> dark clear colour, NOT green.
  expect(corner?.g ?? 255).toBeLessThan(90);
  expect(corner2?.g ?? 255).toBeLessThan(90);

  // The mask genuinely gates the content: far more green at the center than the
  // corner (without stencil the content would be green everywhere).
  expect((center?.g ?? 0) - (corner?.g ?? 0)).toBeGreaterThan(60);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_STENCIL_PORTAL_STOP__?: () => void;
      }
    ).__APERTURE_STENCIL_PORTAL_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
