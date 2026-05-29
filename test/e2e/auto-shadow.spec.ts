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

interface AutoShadowStatus extends ExampleStatusBase {
  readonly frame?: number;
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly shadowRequests: number;
    readonly diagnostics: number;
  };
  readonly shadow?: {
    readonly controls: {
      readonly receiverEnabled: boolean;
    };
    readonly requests: readonly {
      readonly lightKind: string;
      readonly cascadeCount: number;
    }[];
    readonly report: {
      readonly status: string;
      readonly shadowKind: string | null;
      readonly requestCount: number;
      readonly passCount: number;
      readonly drawCalls: number;
      readonly commandBufferSubmission: {
        readonly status: string;
        readonly submittedCommandBuffers: number;
      };
      readonly sections: {
        readonly commandBufferSubmission: boolean;
        readonly receiverResources: boolean;
      };
    } | null;
    readonly rendering: {
      readonly supported: boolean;
      readonly mode: string;
      readonly cascadeCount: number;
      readonly pipelineKey: string | null;
    };
  };
  readonly draw?: {
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

test("Playwright renders frame-loop auto shadows on standard receivers", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/auto-shadow.html?disable-shadow-receiver=1");
  let status = await waitForExampleStatus<AutoShadowStatus>(page);

  expect(status, "auto-shadow baseline status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  await waitForAutoShadowFrame(page, 3);
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/auto-shadow.html?stop-after-ready=1");
  status = await waitForExampleStatus<AutoShadowStatus>(page);

  expect(status, "auto-shadow status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  status = await waitForAutoShadowFrame(page, 3, true);
  await attachExampleStatus("auto-shadow-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "auto-shadow",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-auto-shadow",
    extraction: {
      views: 1,
      meshDraws: 4,
      lights: 2,
      shadowRequests: 1,
      diagnostics: 0,
    },
    shadow: {
      controls: {
        receiverEnabled: true,
      },
      requests: [{ lightKind: "directional", cascadeCount: 4 }],
      report: {
        status: "submitted",
        shadowKind: "directional-cascaded",
        requestCount: 1,
        passCount: 4,
        commandBufferSubmission: {
          status: "submitted",
          submittedCommandBuffers: 1,
        },
        sections: {
          commandBufferSubmission: true,
          receiverResources: true,
        },
      },
      rendering: {
        supported: true,
        mode: "frame-loop-auto-directional-csm",
        cascadeCount: 4,
      },
    },
    draw: {
      drawCalls: 4,
      indexedDrawCalls: 4,
    },
  });
  expect(status.shadow?.report?.drawCalls).toBeGreaterThanOrEqual(8);
  expect(status.shadow?.rendering.pipelineKey).toContain("shadowMap");
  expect(status.shadow?.rendering.pipelineKey).toContain("cascadedShadowMap");

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("auto-shadow-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleAutoShadowScene(screenshot, status);
  expectAutoShadowActivation(noShadowScreenshot, screenshot, status);
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

async function waitForAutoShadowFrame(
  page: Parameters<typeof waitForExampleStatus>[0],
  minimumFrame: number,
  requireRendering = false,
): Promise<AutoShadowStatus> {
  await page.waitForFunction(
    ({ minimumFrame, requireRendering }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: AutoShadowStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status !== undefined &&
        (status.frame ?? 0) >= minimumFrame &&
        (!requireRendering || status.shadow?.rendering.supported === true)
      );
    },
    { minimumFrame, requireRendering },
  );

  return page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: AutoShadowStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectVisibleAutoShadowScene(
  screenshot: Buffer,
  status: AutoShadowStatus,
): void {
  const clear = clearPixel(status);
  const samples = {
    nearReceiver: strongestRegionSample(
      screenshot,
      clear,
      0.24,
      0.28,
      0.55,
      0.78,
    ),
    farReceiver: strongestRegionSample(
      screenshot,
      clear,
      0.52,
      0.3,
      0.82,
      0.78,
    ),
    nearCaster: strongestRegionSample(screenshot, clear, 0.3, 0.3, 0.52, 0.66),
    farCaster: strongestRegionSample(screenshot, clear, 0.56, 0.34, 0.8, 0.68),
  };

  for (const [name, sample] of Object.entries(samples)) {
    expect(
      pixelDistance(sample, clear),
      `${name} region should contain non-clear pixels; sample=${JSON.stringify(
        sample,
      )}`,
    ).toBeGreaterThan(20);
  }
}

function expectAutoShadowActivation(
  baseline: Buffer,
  shadowed: Buffer,
  status: AutoShadowStatus,
): void {
  const clear = clearPixel(status);
  const regions = [
    {
      name: "near auto-shadow receiver",
      region: { x0: 0.24, y0: 0.34, x1: 0.54, y1: 0.72 },
    },
    {
      name: "far auto-shadow receiver",
      region: { x0: 0.52, y0: 0.36, x1: 0.82, y1: 0.74 },
    },
  ] as const;

  for (const { name, region } of regions) {
    const shadowedLuminance = averageRegionLuminance(shadowed, clear, region);
    const maxDelta = maxRegionLuminanceDelta(baseline, shadowed, clear, region);

    expect(
      shadowedLuminance.visibleSamples,
      `${name} should contain visible samples; shadowed=${JSON.stringify(
        shadowedLuminance,
      )}`,
    ).toBeGreaterThanOrEqual(4);
    expect(
      maxDelta,
      `${name} should change after frame-loop auto-shadow sampling; maxDelta=${maxDelta}`,
    ).toBeGreaterThan(10);
  }
}

function clearPixel(status: AutoShadowStatus) {
  return status.clearColor === undefined
    ? { r: 3, g: 5, b: 7, a: 255 }
    : rgbaColorToPixel(status.clearColor);
}

function strongestRegionSample(
  screenshot: Buffer,
  clear: ReturnType<typeof clearPixel>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  let strongest = readPngPixel(screenshot, x0, y0);
  let strongestDistance = pixelDistance(strongest, clear);

  for (let yi = 0; yi <= 4; yi += 1) {
    for (let xi = 0; xi <= 4; xi += 1) {
      const x = x0 + ((x1 - x0) * xi) / 4;
      const y = y0 + ((y1 - y0) * yi) / 4;
      const sample = readPngPixel(screenshot, x, y);
      const distance = pixelDistance(sample, clear);

      if (distance > strongestDistance) {
        strongest = sample;
        strongestDistance = distance;
      }
    }
  }

  return strongest;
}

function averageRegionLuminance(
  screenshot: Buffer,
  clear: ReturnType<typeof clearPixel>,
  region: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  },
) {
  let total = 0;
  let visibleSamples = 0;

  for (let yi = 0; yi <= 4; yi += 1) {
    for (let xi = 0; xi <= 4; xi += 1) {
      const sample = readPngPixel(
        screenshot,
        region.x0 + ((region.x1 - region.x0) * xi) / 4,
        region.y0 + ((region.y1 - region.y0) * yi) / 4,
      );

      if (pixelDistance(sample, clear) <= 20) {
        continue;
      }

      total += luminance(sample);
      visibleSamples += 1;
    }
  }

  return {
    average: visibleSamples === 0 ? 0 : total / visibleSamples,
    visibleSamples,
  };
}

function maxRegionLuminanceDelta(
  before: Buffer,
  after: Buffer,
  clear: ReturnType<typeof clearPixel>,
  region: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  },
) {
  let maxDelta = 0;

  for (let yi = 0; yi <= 4; yi += 1) {
    for (let xi = 0; xi <= 4; xi += 1) {
      const x = region.x0 + ((region.x1 - region.x0) * xi) / 4;
      const y = region.y0 + ((region.y1 - region.y0) * yi) / 4;
      const beforeSample = readPngPixel(before, x, y);
      const afterSample = readPngPixel(after, x, y);

      if (
        pixelDistance(beforeSample, clear) <= 20 &&
        pixelDistance(afterSample, clear) <= 20
      ) {
        continue;
      }

      maxDelta = Math.max(
        maxDelta,
        Math.abs(luminance(beforeSample) - luminance(afterSample)),
      );
    }
  }

  return maxDelta;
}

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
