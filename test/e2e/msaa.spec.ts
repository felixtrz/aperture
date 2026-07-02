import { expect, test, type Page } from "@playwright/test";

import { readPngImage, readPngImagePixel, type PngImage } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MsaaStatus extends ExampleStatusBase {
  readonly canvas?: {
    readonly oneX: { readonly width: number; readonly height: number };
    readonly eightX: { readonly width: number; readonly height: number };
  };
  readonly oneX?: MsaaFrameStatus;
  readonly eightX?: MsaaFrameStatus;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
}

interface MsaaFrameStatus {
  readonly requestedSampleCount: number;
  readonly sampleCount: number;
  readonly enabled: boolean;
  readonly clamped: boolean;
  readonly colorTargets: number;
  readonly colorTexturesCreated: number;
  readonly renderTarget: {
    readonly width: number;
    readonly height: number;
    readonly drawCalls: number;
    readonly msaaSampleCount: number;
  };
  readonly attachment: {
    readonly storeOp: string | null;
    readonly resolveTarget: boolean;
  };
}

test("browser resolves MSAA render targets with visibly smoother edges", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto("/examples/msaa.html");

  const status = await waitForExampleStatus<MsaaStatus>(page);

  await attachExampleStatus("msaa-status", status);
  expect(status, "MSAA status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "msaa",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      oneX: { width: 512, height: 512 },
      eightX: { width: 512, height: 512 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    oneX: {
      requestedSampleCount: 1,
      sampleCount: 1,
      enabled: false,
      clamped: false,
      renderTarget: {
        width: 512,
        height: 512,
        drawCalls: 1,
        msaaSampleCount: 1,
      },
      attachment: {
        storeOp: "store",
        resolveTarget: false,
      },
    },
    eightX: {
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      colorTargets: 1,
      renderTarget: {
        width: 512,
        height: 512,
        drawCalls: 1,
        msaaSampleCount: 4,
      },
      attachment: {
        storeOp: "discard",
        resolveTarget: true,
      },
    },
  });

  await page.waitForTimeout(100);

  const oneXScreenshot = await readCanvasPng(page, "#msaa-canvas-1x");
  const eightXScreenshot = await readCanvasPng(page, "#msaa-canvas-8x");
  const oneXImage = readPngImage(oneXScreenshot);
  const eightXImage = readPngImage(eightXScreenshot);
  const oneXPartialPixels = countPartialEdgePixels(oneXImage);
  const eightXPartialPixels = countPartialEdgePixels(eightXImage);

  await test.info().attach("msaa-edge-metrics", {
    body: JSON.stringify(
      {
        oneXPartialPixels,
        eightXPartialPixels,
        oneXCenter: readPngImagePixel(oneXImage, 0.5, 0.5),
        eightXCenter: readPngImagePixel(eightXImage, 0.5, 0.5),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await test.info().attach("msaa-1x-canvas", {
    body: oneXScreenshot,
    contentType: "image/png",
  });
  await test.info().attach("msaa-8x-canvas", {
    body: eightXScreenshot,
    contentType: "image/png",
  });

  expect(oneXImage.width).toBe(512);
  expect(oneXImage.height).toBe(512);
  expect(eightXImage.width).toBe(512);
  expect(eightXImage.height).toBe(512);
  expect(
    eightXPartialPixels,
    `MSAA should resolve more partial-coverage edge pixels than 1x; 1x=${oneXPartialPixels}, 8x=${eightXPartialPixels}`,
  ).toBeGreaterThan(Math.max(80, oneXPartialPixels * 2));

  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

async function readCanvasPng(page: Page, selector: string): Promise<Buffer> {
  const dataUrl = await page.locator(selector).evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("Selected element is not a canvas.");
    }
    return element.toDataURL("image/png");
  });
  const encoded = dataUrl.replace(/^data:image\/png;base64,/u, "");

  return Buffer.from(encoded, "base64");
}

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
