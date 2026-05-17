import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface StandardQueuePhasesStatus extends ExampleStatusBase {
  readonly frame?: number;
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly queues?: readonly string[];
  readonly pipelineKeys?: readonly string[];
  readonly expectedSamples?: {
    readonly alphaCutout: readonly [number, number, number, number];
    readonly transparentBlend: readonly [number, number, number, number];
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
}

test("browser renders StandardMaterial opaque, alpha-test, and transparent queue phases", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-queue-phases.html");

  const status = await waitForExampleStatus<StandardQueuePhasesStatus>(page);

  await attachExampleStatus("standard-queue-phases-status", status);
  expect(status, "standard queue phase status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-queue-phases",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    queues: ["opaque", "opaque", "alpha-test", "transparent"],
    pipelineKeys: [
      "standard|opaque|none|less|none",
      "standard|opaque|none|less|none",
      "standard|mask|none|less|none",
      "standard|blend|none|less|alpha",
    ],
    counts: {
      meshDraws: 4,
      drawCalls: 4,
      diagnostics: 0,
    },
  });

  const renderedStatus = await waitForQueuePhaseFrame(
    page,
    Math.max((status.frame ?? 0) + 2, 3),
  );
  await attachExampleStatus(
    "standard-queue-phases-rendered-status",
    renderedStatus,
  );
  expectStatusJsonSafeForGpu(renderedStatus);
  webGpuValidation.expectNoWarnings();

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("standard-queue-phases.png", {
    body: screenshot,
    contentType: "image/png",
  });

  const alphaCutout = strongestRegionSample(screenshot, 0.38, 0.43, 0.5, 0.66);
  const transparentBlend = strongestRegionSample(
    screenshot,
    0.5,
    0.43,
    0.62,
    0.66,
  );
  const expectedAlphaCutout = rgbaTupleToPixel(
    renderedStatus.expectedSamples?.alphaCutout ?? [0.95, 0.08, 0.04, 1],
  );
  const expectedTransparentBlend = rgbaTupleToPixel(
    renderedStatus.expectedSamples?.transparentBlend ?? [0.54, 0.54, 0.54, 1],
  );
  const clear = rgbaColorToPixel(
    renderedStatus.clearColor ?? { r: 0.02, g: 0.025, b: 0.03, a: 1 },
  );

  expect(
    pixelDistance(alphaCutout, expectedAlphaCutout),
    `alpha-test cutout should reveal opaque red behind it; sample=${JSON.stringify(
      alphaCutout,
    )}`,
  ).toBeLessThan(90);
  expect(pixelDistance(alphaCutout, clear)).toBeGreaterThan(80);

  expect(
    pixelDistance(transparentBlend, expectedTransparentBlend),
    `transparent alpha blend should mix yellow over blue; sample=${JSON.stringify(
      transparentBlend,
    )}`,
  ).toBeLessThan(110);
  expect(pixelDistance(transparentBlend, clear)).toBeGreaterThan(70);
});

function rgbaTupleToPixel(
  tuple: readonly [number, number, number, number],
): ReturnType<typeof rgbaColorToPixel> {
  return rgbaColorToPixel({
    r: tuple[0],
    g: tuple[1],
    b: tuple[2],
    a: tuple[3],
  });
}

function strongestRegionSample(
  screenshot: Buffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ReturnType<typeof readPngPixel> {
  const clear = { r: 5, g: 6, b: 8, a: 255 };
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

async function waitForQueuePhaseFrame(
  page: Page,
  minimumFrame: number,
): Promise<StandardQueuePhasesStatus> {
  await page.waitForFunction((frame) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: StandardQueuePhasesStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return status?.ok === true && (status.frame ?? 0) >= frame;
  }, minimumFrame);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: StandardQueuePhasesStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as StandardQueuePhasesStatus,
  );
}
