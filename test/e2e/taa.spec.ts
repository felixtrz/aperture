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

interface TaaStatus extends ExampleStatusBase {
  readonly canvas?: {
    readonly raw: { readonly width: number; readonly height: number };
    readonly taa: { readonly width: number; readonly height: number };
  };
  readonly raw?: TaaFrameStatus;
  readonly taa?: TaaFrameStatus;
  readonly motionVectors?: TaaMotionVectorStatus | null;
  readonly worker?: {
    readonly snapshotsReceived: number;
    readonly step?: {
      readonly objectOffset?: number;
    };
  };
  readonly extraction?: {
    readonly frame: number;
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
}

interface TaaFrameStatus {
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
  readonly motionVectors?: TaaMotionVectorStatus | null;
}

interface TaaMotionVectorStatus {
  readonly required: boolean;
  readonly status: string;
  readonly colorFormat: string | null;
  readonly objectTransforms: {
    readonly available: boolean;
    readonly resourceKey: string | null;
    readonly total: number;
    readonly used: number;
    readonly fallback: number;
    readonly missing: readonly number[];
    readonly stored: number;
    readonly staleRemoved: number;
  };
}

test("browser accumulates jittered frames through TAA history and motion vectors", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto("/examples/taa.html");

  const status = await waitForExampleStatus<TaaStatus>(page);

  await attachExampleStatus("taa-status", status);
  expect(status, "TAA status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "taa",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      raw: { width: 512, height: 512 },
      taa: { width: 512, height: 512 },
    },
    extraction: {
      frame: 24,
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    raw: {
      ok: true,
      renderTarget: {
        width: 512,
        height: 512,
        drawCalls: 1,
      },
      postEffects: [],
    },
    taa: {
      ok: true,
      renderTarget: {
        width: 512,
        height: 512,
        drawCalls: 1,
      },
      postEffects: [
        { effectId: "taa", output: "offscreen", ok: true },
        { effectId: "taa-present", output: "swapchain", ok: true },
      ],
      boundaries: 3,
      motionVectors: {
        required: true,
        status: "scene-attachment",
        objectTransforms: {
          available: true,
          total: 1,
          used: 1,
          fallback: 0,
          stored: 1,
        },
      },
    },
    motionVectors: {
      required: true,
      status: "scene-attachment",
      objectTransforms: {
        available: true,
        total: 1,
        used: 1,
        fallback: 0,
        stored: 1,
      },
    },
    worker: {
      snapshotsReceived: 24,
    },
  });
  expect(status.motionVectors?.objectTransforms.resourceKey).toContain(
    "PreviousWorldTransforms/storage",
  );
  expect(status.worker?.step?.objectOffset ?? 0).not.toBe(0);

  await page.waitForTimeout(100);

  const rawScreenshot = await page.locator("#taa-canvas-raw").screenshot();
  const taaScreenshot = await page.locator("#taa-canvas-taa").screenshot();
  const rawImage = readPngImage(rawScreenshot);
  const taaImage = readPngImage(taaScreenshot);
  const rawPartialPixels = countPartialEdgePixels(rawImage);
  const taaPartialPixels = countPartialEdgePixels(taaImage);

  await test.info().attach("taa-edge-metrics", {
    body: JSON.stringify(
      {
        rawPartialPixels,
        taaPartialPixels,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await test.info().attach("taa-raw-canvas", {
    body: rawScreenshot,
    contentType: "image/png",
  });
  await test.info().attach("taa-canvas", {
    body: taaScreenshot,
    contentType: "image/png",
  });

  expect(rawImage.width).toBe(512);
  expect(rawImage.height).toBe(512);
  expect(taaImage.width).toBe(512);
  expect(taaImage.height).toBe(512);
  expect(
    taaPartialPixels,
    `TAA should accumulate more partial-coverage edge pixels than the raw jittered frame; raw=${rawPartialPixels}, taa=${taaPartialPixels}`,
  ).toBeGreaterThan(Math.max(80, rawPartialPixels * 1.35));

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_TAA_STOP__?: () => void;
      }
    ).__APERTURE_TAA_STOP__;

    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function countPartialEdgePixels(image: PngImage): number {
  let count = 0;

  for (
    let offset = 0;
    offset < image.pixels.length;
    offset += image.bytesPerPixel
  ) {
    const luminance =
      (image.pixels[offset] ?? 0) * 0.299 +
      (image.pixels[offset + 1] ?? 0) * 0.587 +
      (image.pixels[offset + 2] ?? 0) * 0.114;

    if (luminance > 18 && luminance < 240) {
      count += 1;
    }
  }

  return count;
}
