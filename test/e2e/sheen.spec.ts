import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface SheenStatus extends ExampleStatusBase {
  readonly sheen?: {
    readonly meshKey: string;
    readonly baseMaterialKey: string;
    readonly fabricMaterialKey: string;
    readonly sheenColorFactor: readonly [number, number, number];
    readonly sheenRoughnessFactor: number;
  };
  readonly frame?: SheenFrameStatus;
}

interface SheenFrameStatus {
  readonly snapshot?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly pipelineKeys?: readonly string[];
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
      };
    }[];
  };
}

test("browser renders scalar sheen with a distinct fabric rim response", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/sheen.html");

  const status = await waitForExampleStatus<SheenStatus>(page);

  await attachExampleStatus("sheen-status", status);
  expect(status, "sheen status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "sheen",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: 960,
      height: 960,
    },
    sheen: {
      meshKey: "mesh:sheen-panel-mesh",
      baseMaterialKey: "material:sheen-base-material",
      fabricMaterialKey: "material:sheen-fabric-material",
      sheenColorFactor: [1, 0.55, 0.22],
      sheenRoughnessFactor: 0.28,
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 2,
        lights: 2,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 2,
        diagnostics: 0,
      },
    },
  });

  const frame = status.frame;

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  if (frame === undefined) {
    return;
  }

  expect(frame.counts?.drawCalls).toBeGreaterThanOrEqual(1);
  expect(frame.pipelineKeys).toEqual(
    expect.arrayContaining([
      "standard|opaque|none|less|none",
      "standard|sheen|opaque|none|less|none",
    ]),
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("sheen-canvas", {
    body: screenshot,
    contentType: "image/png",
  });

  assertSheenScreenshot(screenshot);
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function assertSheenScreenshot(screenshot: Buffer): void {
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.02, b: 0.024, a: 1 });
  const basePanel = readPngPixel(screenshot, 0.34, 0.42);
  const sheenPanel = readPngPixel(screenshot, 0.77, 0.42);
  const background = readPngPixel(screenshot, 0.5, 0.12);

  expect(pixelDistance(basePanel, clear)).toBeGreaterThan(30);
  expect(pixelDistance(sheenPanel, clear)).toBeGreaterThan(30);
  expect(pixelDistance(background, clear)).toBeLessThan(12);
  expect(luminance(sheenPanel)).toBeGreaterThan(luminance(basePanel) + 60);
  expect(sheenPanel.g).toBeGreaterThan(basePanel.g + 60);
}

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
