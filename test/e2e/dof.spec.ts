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

interface DofStatus extends ExampleStatusBase {
  readonly canvas?: {
    readonly raw: { readonly width: number; readonly height: number };
    readonly dof: { readonly width: number; readonly height: number };
  };
  readonly raw?: DofFrameStatus;
  readonly dof?: DofFrameStatus;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly worker?: {
    readonly snapshotsReceived: number;
  };
}

interface DofFrameStatus {
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

test("browser blurs background while preserving focused foreground with depth of field", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto("/examples/dof.html");

  const status = await waitForExampleStatus<DofStatus>(page);

  await attachExampleStatus("dof-status", status);
  expect(status, "DOF status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "dof",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      raw: { width: 512, height: 512 },
      dof: { width: 512, height: 512 },
    },
    extraction: {
      views: 1,
      meshDraws: 32,
      diagnostics: 0,
    },
    dof: {
      ok: true,
      postEffects: [{ effectId: "dof", output: "swapchain", ok: true }],
      boundaries: 2,
    },
    worker: {
      snapshotsReceived: 1,
    },
  });

  await page.waitForTimeout(100);

  const rawScreenshot = await page.locator("#dof-canvas-raw").screenshot();
  const dofScreenshot = await page.locator("#dof-canvas-dof").screenshot();
  const rawImage = readPngImage(rawScreenshot);
  const dofImage = readPngImage(dofScreenshot);
  const backgroundRegion = { x: 48, y: 58, width: 416, height: 112 };
  const foregroundRegion = { x: 222, y: 222, width: 68, height: 68 };
  const rawBackgroundContrast = averageHorizontalContrast(
    rawImage,
    backgroundRegion,
  );
  const dofBackgroundContrast = averageHorizontalContrast(
    dofImage,
    backgroundRegion,
  );
  const backgroundMeanDelta = averagePixelDelta(
    rawImage,
    dofImage,
    backgroundRegion,
  );
  const changedBackgroundPixels = countChangedPixels(
    rawImage,
    dofImage,
    backgroundRegion,
    18,
  );
  const foregroundMeanDelta = averagePixelDelta(
    rawImage,
    dofImage,
    foregroundRegion,
  );

  await test.info().attach("dof-blur-metrics", {
    body: JSON.stringify(
      {
        rawBackgroundContrast,
        dofBackgroundContrast,
        backgroundMeanDelta,
        changedBackgroundPixels,
        foregroundMeanDelta,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await test.info().attach("dof-raw-canvas", {
    body: rawScreenshot,
    contentType: "image/png",
  });
  await test.info().attach("dof-canvas", {
    body: dofScreenshot,
    contentType: "image/png",
  });

  expect(rawImage.width).toBe(512);
  expect(rawImage.height).toBe(512);
  expect(dofImage.width).toBe(512);
  expect(dofImage.height).toBe(512);
  expect(
    rawBackgroundContrast,
    `The raw background stripe field should have enough contrast to prove blur; rawBackgroundContrast=${rawBackgroundContrast}`,
  ).toBeGreaterThan(9);
  expect(
    changedBackgroundPixels,
    `DOF should visibly alter many background stripe pixels; changedBackgroundPixels=${changedBackgroundPixels}`,
  ).toBeGreaterThan(2400);
  expect(
    backgroundMeanDelta,
    `Background blur should change background pixels more than the focused foreground; background=${backgroundMeanDelta}, foreground=${foregroundMeanDelta}`,
  ).toBeGreaterThan(foregroundMeanDelta * 4);
  expect(
    foregroundMeanDelta,
    `Focused foreground should stay sharp and largely unchanged; foregroundMeanDelta=${foregroundMeanDelta}`,
  ).toBeLessThan(8);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_DOF_STOP__?: () => void;
      }
    ).__APERTURE_DOF_STOP__;

    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function averageHorizontalContrast(
  image: PngImage,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): number {
  let total = 0;
  let count = 0;
  const maxX = Math.min(image.width - 1, region.x + region.width);
  const maxY = Math.min(image.height, region.y + region.height);

  for (let y = region.y; y < maxY; y += 1) {
    for (let x = region.x; x < maxX; x += 1) {
      const offset = (y * image.width + x) * image.bytesPerPixel;
      const nextOffset = offset + image.bytesPerPixel;

      total += pixelDistance(image.pixels, image.pixels, offset, nextOffset);
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

function averagePixelDelta(
  a: PngImage,
  b: PngImage,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): number {
  let total = 0;
  let count = 0;
  const maxX = Math.min(a.width, b.width, region.x + region.width);
  const maxY = Math.min(a.height, b.height, region.y + region.height);

  for (let y = region.y; y < maxY; y += 1) {
    for (let x = region.x; x < maxX; x += 1) {
      const offset = (y * a.width + x) * a.bytesPerPixel;

      total += pixelDistance(a.pixels, b.pixels, offset, offset);
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

function countChangedPixels(
  a: PngImage,
  b: PngImage,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  threshold: number,
): number {
  let count = 0;
  const maxX = Math.min(a.width, b.width, region.x + region.width);
  const maxY = Math.min(a.height, b.height, region.y + region.height);

  for (let y = region.y; y < maxY; y += 1) {
    for (let x = region.x; x < maxX; x += 1) {
      const offset = (y * a.width + x) * a.bytesPerPixel;

      if (pixelDistance(a.pixels, b.pixels, offset, offset) > threshold) {
        count += 1;
      }
    }
  }

  return count;
}

function pixelDistance(
  a: Uint8Array,
  b: Uint8Array,
  aOffset: number,
  bOffset: number,
): number {
  return (
    Math.abs((a[aOffset] ?? 0) - (b[bOffset] ?? 0)) +
    Math.abs((a[aOffset + 1] ?? 0) - (b[bOffset + 1] ?? 0)) +
    Math.abs((a[aOffset + 2] ?? 0) - (b[bOffset + 2] ?? 0))
  );
}
