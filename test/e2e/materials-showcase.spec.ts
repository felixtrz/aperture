import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MaterialShowcaseStatus extends ExampleStatusBase {
  readonly materialModels?: readonly string[];
  readonly frame?: number;
  readonly animation?: {
    readonly elapsedSeconds: number;
    readonly spinningCubes: number;
  };
  readonly draw?: {
    readonly cubes: number;
    readonly indexedDrawCalls: number;
    readonly indexCount: number;
  };
}

test("Playwright shows three spinning material showcase cubes", async ({
  page,
}) => {
  await page.goto("/examples/materials-showcase.html");

  const initialStatus =
    await waitForExampleStatus<MaterialShowcaseStatus>(page);

  await attachExampleStatus("materials-showcase-initial-status", initialStatus);
  expect(
    initialStatus,
    "materials showcase status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  expectStatusJsonSafeForGpu(initialStatus);
  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "materials-showcase",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    materialModels: ["unlit", "standard-pbr", "matcap"],
    animation: { spinningCubes: 3 },
    draw: { cubes: 3, indexedDrawCalls: 3, indexCount: 36 },
  });

  const firstFrame = initialStatus.frame ?? 0;
  const firstScreenshot = await page.locator("#aperture-canvas").screenshot();

  expectVisibleMaterialRegions(firstScreenshot);

  const laterStatus = await waitForShowcaseFrame(page, firstFrame + 12);
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();

  await attachExampleStatus("materials-showcase-later-status", laterStatus);
  await test.info().attach("materials-showcase-frame.png", {
    body: laterScreenshot,
    contentType: "image/png",
  });
  expectStatusJsonSafeForGpu(laterStatus);
  expect(laterStatus.frame ?? 0).toBeGreaterThanOrEqual(firstFrame + 12);
  expectVisibleMaterialRegions(laterScreenshot);
});

function expectVisibleMaterialRegions(screenshot: Buffer): void {
  const clear = { r: 4, g: 5, b: 7, a: 255 };
  const samples = {
    unlit: strongestRegionSample(screenshot, 0.28, 0.43, 0.41, 0.65),
    standard: strongestRegionSample(screenshot, 0.43, 0.43, 0.57, 0.65),
    matcap: strongestRegionSample(screenshot, 0.57, 0.43, 0.73, 0.65),
  };

  for (const [name, sample] of Object.entries(samples)) {
    expect(
      pixelDistance(sample, clear),
      `${name} cube region should contain non-clear pixels; sample=${JSON.stringify(
        sample,
      )}`,
    ).toBeGreaterThan(36);
  }

  expect(pixelDistance(samples.unlit, samples.standard)).toBeGreaterThan(30);
  expect(pixelDistance(samples.standard, samples.matcap)).toBeGreaterThan(24);
}

function strongestRegionSample(
  screenshot: Buffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ReturnType<typeof readPngPixel> {
  const clear = { r: 4, g: 5, b: 7, a: 255 };
  let strongest = clear;
  let strongestDistance = 0;

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const sample = readPngPixel(
        screenshot,
        minX + ((maxX - minX) * x) / 4,
        minY + ((maxY - minY) * y) / 4,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > strongestDistance) {
        strongest = sample;
        strongestDistance = distance;
      }
    }
  }

  return strongest;
}

async function waitForShowcaseFrame(
  page: Page,
  minimumFrame: number,
): Promise<MaterialShowcaseStatus> {
  await page.waitForFunction((frame) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: MaterialShowcaseStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return status?.ok === true && (status.frame ?? 0) >= frame;
  }, minimumFrame);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: MaterialShowcaseStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as MaterialShowcaseStatus,
  );
}
