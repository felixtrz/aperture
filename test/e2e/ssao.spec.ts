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
    readonly msaaSampleCount: number;
  };
  readonly msaa: {
    readonly requestedSampleCount: number;
    readonly sampleCount: number;
    readonly enabled: boolean;
    readonly clamped: boolean;
    readonly colorTargets: number;
  };
  readonly postEffects: readonly {
    readonly effectId: string;
    readonly output: string;
    readonly ok: boolean;
  }[];
  readonly boundaries: number;
}

test("browser darkens contact regions through depth-fed SSAO with MSAA depth", async ({
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
  try {
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
          // (scene draw count is environment/skybox dependent — not pinned here)
          msaaSampleCount: 1,
        },
        msaa: {
          requestedSampleCount: 1,
          sampleCount: 1,
          enabled: false,
          clamped: false,
          colorTargets: 0,
        },
        postEffects: [],
      },
      ssao: {
        ok: true,
        renderTarget: {
          width: 512,
          height: 512,
          // (scene draw count is environment/skybox dependent — not pinned here)
          msaaSampleCount: 4,
        },
        msaa: {
          requestedSampleCount: 8,
          sampleCount: 4,
          enabled: true,
          clamped: true,
          colorTargets: 1,
        },
        postEffects: [{ effectId: "ssao", output: "swapchain", ok: true }],
        boundaries: 2,
      },
      worker: {
        snapshotsReceived: 1,
      },
    });
    await waitForPresentedFrames(page, 10);

    const rawScreenshot = await page.locator("#ssao-canvas-raw").screenshot();
    const ssaoScreenshot = await page.locator("#ssao-canvas-ssao").screenshot();
    const rawImage = cropLocatorScreenshotToCanvas(readPngImage(rawScreenshot));
    const ssaoImage = cropLocatorScreenshotToCanvas(
      readPngImage(ssaoScreenshot),
    );
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

    webGpuValidation.expectNoWarnings();
  } finally {
    await stopSsaoRuntime(page);
  }
});

async function stopSsaoRuntime(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const stop = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_SSAO_STOP__?: () => void;
        }
      ).__APERTURE_SSAO_STOP__;

      stop?.();
    })
    .catch(() => {});
  await page.close({ runBeforeUnload: false }).catch(() => {});
}

function cropLocatorScreenshotToCanvas(image: PngImage): PngImage {
  // Locator screenshots can round a fractional element bound outward by one
  // pixel. The canvas backing store and render target stay 512x512; trim only
  // that benign screenshot overscan before pixel comparisons.
  expect(image.width).toBeGreaterThanOrEqual(512);
  expect(image.height).toBeGreaterThanOrEqual(512);
  expect(image.width).toBeLessThanOrEqual(513);
  expect(image.height).toBeLessThanOrEqual(513);

  if (image.width === 512 && image.height === 512) {
    return image;
  }

  const width = 512;
  const height = 512;
  const rowBytes = width * image.bytesPerPixel;
  const sourceRowBytes = image.width * image.bytesPerPixel;
  const pixels = new Uint8Array(rowBytes * height);

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * sourceRowBytes;
    pixels.set(
      image.pixels.subarray(sourceOffset, sourceOffset + rowBytes),
      y * rowBytes,
    );
  }

  return {
    width,
    height,
    bytesPerPixel: image.bytesPerPixel,
    pixels,
  };
}

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
