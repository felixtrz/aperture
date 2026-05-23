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

interface SsaoStatus extends ExampleStatusBase {
  readonly canvas?: {
    readonly raw: { readonly width: number; readonly height: number };
    readonly ssao: { readonly width: number; readonly height: number };
  };
  readonly raw?: SsaoFrameStatus;
  readonly ssao?: SsaoFrameStatus;
  readonly comparison?: {
    readonly readbackAvailable: boolean;
    readonly darkenedSamples: readonly string[];
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly worker?: {
    readonly snapshotsReceived: number;
  };
}

interface SsaoFrameStatus {
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

test("browser darkens contact regions through depth-fed SSAO", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto("/examples/ssao.html");

  const status = await waitForExampleStatus<SsaoStatus>(page);

  await attachExampleStatus("ssao-status", status);
  expect(status, "SSAO status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ssao",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      raw: { width: 512, height: 512 },
      ssao: { width: 512, height: 512 },
    },
    extraction: {
      views: 1,
      meshDraws: 4,
      diagnostics: 0,
    },
    raw: {
      ok: true,
      renderTarget: {
        width: 512,
        height: 512,
        drawCalls: 3,
      },
      postEffects: [],
    },
    ssao: {
      ok: true,
      renderTarget: {
        width: 512,
        height: 512,
        drawCalls: 3,
      },
      postEffects: [{ effectId: "ssao", output: "swapchain", ok: true }],
      boundaries: 2,
    },
    worker: {
      snapshotsReceived: 1,
    },
  });
  await page.waitForTimeout(100);

  const rawScreenshot = await page.locator("#ssao-canvas-raw").screenshot();
  const ssaoScreenshot = await page.locator("#ssao-canvas-ssao").screenshot();
  const rawImage = readPngImage(rawScreenshot);
  const ssaoImage = readPngImage(ssaoScreenshot);
  const darkerPixels = countDarkerPixels(rawImage, ssaoImage);

  await test.info().attach("ssao-darkening-metrics", {
    body: JSON.stringify(
      {
        darkerPixels,
        readbackDarkenedSamples: status.comparison?.darkenedSamples ?? [],
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await test.info().attach("ssao-raw-canvas", {
    body: rawScreenshot,
    contentType: "image/png",
  });
  await test.info().attach("ssao-canvas", {
    body: ssaoScreenshot,
    contentType: "image/png",
  });

  expect(rawImage.width).toBe(512);
  expect(rawImage.height).toBe(512);
  expect(ssaoImage.width).toBe(512);
  expect(ssaoImage.height).toBe(512);
  expect(
    darkerPixels,
    `SSAO should visibly darken contact/depth-discontinuity pixels; darkerPixels=${darkerPixels}`,
  ).toBeGreaterThan(120);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_SSAO_STOP__?: () => void;
      }
    ).__APERTURE_SSAO_STOP__;

    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function countDarkerPixels(raw: PngImage, ssao: PngImage): number {
  const length = Math.min(raw.pixels.length, ssao.pixels.length);
  let count = 0;

  for (let offset = 0; offset < length; offset += raw.bytesPerPixel) {
    const rawLuma = pixelLuma(raw.pixels, offset);
    const ssaoLuma = pixelLuma(ssao.pixels, offset);

    if (rawLuma > 18 && rawLuma - ssaoLuma > 7) {
      count += 1;
    }
  }

  return count;
}

function pixelLuma(pixels: Uint8Array, offset: number): number {
  return (
    (pixels[offset] ?? 0) * 0.2126 +
    (pixels[offset + 1] ?? 0) * 0.7152 +
    (pixels[offset + 2] ?? 0) * 0.0722
  );
}
