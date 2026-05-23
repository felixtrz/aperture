import { expect, test } from "@playwright/test";

import { readPngImage, type PngImage } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface SsrStatus extends ExampleStatusBase {
  readonly canvas?: {
    readonly raw: { readonly width: number; readonly height: number };
    readonly ssr: { readonly width: number; readonly height: number };
  };
  readonly raw?: SsrFrameStatus;
  readonly ssr?: SsrFrameStatus;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
}

interface SsrFrameStatus {
  readonly ok: boolean;
  readonly renderTarget: {
    readonly width: number;
    readonly height: number;
    readonly drawCalls: number;
  };
  readonly postEffects: readonly {
    readonly effectId: string;
    readonly output: string;
    readonly ok: boolean;
  }[];
  readonly boundaries: number;
}

test("browser blends visible screen-space reflections from scene depth", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto("/examples/ssr.html");

  const status = await waitForExampleStatus<SsrStatus>(page);

  await attachExampleStatus("ssr-status", status);
  expect(status, "SSR status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ssr",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      raw: { width: 512, height: 512 },
      ssr: { width: 512, height: 512 },
    },
    extraction: {
      views: 1,
      meshDraws: 4,
      diagnostics: 0,
    },
    ssr: {
      ok: true,
      postEffects: [{ effectId: "ssr", output: "swapchain", ok: true }],
      boundaries: 2,
    },
  });

  await page.waitForTimeout(100);

  const rawScreenshot = await page.locator("#ssr-canvas-raw").screenshot();
  const ssrScreenshot = await page.locator("#ssr-canvas-ssr").screenshot();
  const rawImage = readPngImage(rawScreenshot);
  const ssrImage = readPngImage(ssrScreenshot);
  const changedFloorPixels = countChangedLowerHalfPixels(rawImage, ssrImage);

  await test.info().attach("ssr-reflection-metrics", {
    body: JSON.stringify({ changedFloorPixels }, null, 2),
    contentType: "application/json",
  });
  await test.info().attach("ssr-raw-canvas", {
    body: rawScreenshot,
    contentType: "image/png",
  });
  await test.info().attach("ssr-canvas", {
    body: ssrScreenshot,
    contentType: "image/png",
  });

  expect(rawImage.width).toBe(512);
  expect(rawImage.height).toBe(512);
  expect(ssrImage.width).toBe(512);
  expect(ssrImage.height).toBe(512);
  expect(
    changedFloorPixels,
    `SSR should visibly alter lower receiver pixels with reflected scene color; changedFloorPixels=${changedFloorPixels}`,
  ).toBeGreaterThan(120);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_SSR_STOP__?: () => void;
      }
    ).__APERTURE_SSR_STOP__;

    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function countChangedLowerHalfPixels(raw: PngImage, ssr: PngImage): number {
  const length = Math.min(raw.pixels.length, ssr.pixels.length);
  let count = 0;

  for (let offset = 0; offset < length; offset += raw.bytesPerPixel) {
    const pixelIndex = offset / raw.bytesPerPixel;
    const y = Math.floor(pixelIndex / raw.width);

    if (y < raw.height * 0.52) {
      continue;
    }

    if (pixelDistance(raw.pixels, ssr.pixels, offset) > 10) {
      count += 1;
    }
  }

  return count;
}

function pixelDistance(a: Uint8Array, b: Uint8Array, offset: number): number {
  return (
    Math.abs((a[offset] ?? 0) - (b[offset] ?? 0)) +
    Math.abs((a[offset + 1] ?? 0) - (b[offset + 1] ?? 0)) +
    Math.abs((a[offset + 2] ?? 0) - (b[offset + 2] ?? 0))
  );
}
