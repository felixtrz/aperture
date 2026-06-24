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

interface PointShadowStatus extends ExampleStatusBase {
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
      readonly casterEnabled: boolean;
    };
    readonly requests: readonly {
      readonly lightKind: string;
    }[];
    readonly descriptor: {
      readonly descriptors: readonly {
        readonly lightKind: string;
        readonly faceCount: number;
        readonly viewDimension: string;
      }[];
    };
    readonly textures: {
      readonly textures: readonly {
        readonly faceCount: number;
        readonly viewDimension: string;
        readonly attachmentViewKeys: readonly string[];
      }[];
    };
    readonly depthTextureResources: {
      readonly status: string;
      readonly resources: readonly {
        readonly faceCount: number;
        readonly viewDimension: string;
        readonly attachmentViewKeys: readonly string[];
        readonly descriptor: {
          readonly size: readonly [number, number, number];
        } | null;
      }[];
    };
    readonly passPlan: {
      readonly status: string;
      readonly passCount: number;
      readonly passes: readonly {
        readonly lightKind: string;
        readonly faceIndex: number;
        readonly faceCount: number;
        readonly passKey: string;
        readonly viewKey: string;
      }[];
    };
    readonly passAttachments: {
      readonly status: string;
      readonly attachmentCount: number;
      readonly attachments: readonly {
        readonly passKey: string;
        readonly viewKey: string;
      }[];
    };
    readonly viewProjection: {
      readonly status: string;
      readonly planCount: number;
      readonly plans: readonly {
        readonly faceIndex: number;
        readonly faceLabel: string;
        readonly passKey: string;
      }[];
    };
    readonly matrixComputation: {
      readonly status: string;
      readonly matrixCount: number;
    };
    readonly matrixBufferResource: {
      readonly status: string;
      readonly matrixCount: number;
    };
    readonly commandEncoding: {
      readonly status: string;
      readonly counts: {
        readonly commandRecords: number;
        readonly drawCommands: number;
      };
      readonly records: readonly {
        readonly passKey: string;
        readonly depthViewKey: string;
      }[];
    };
    readonly encoderAssembly: {
      readonly status: string;
      readonly counts: {
        readonly assembledPasses: number;
        readonly drawCalls: number;
      };
    };
    readonly commandBufferSubmission: {
      readonly status: string;
    };
    readonly rendering: {
      readonly supported: boolean;
      readonly mode: string;
      readonly faceCount: number;
      readonly pipelineKey: string | null;
    };
  };
  readonly draw?: {
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

test("Playwright renders a point light cube-map shadow on the receiver wall", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/point-shadow.html?stop-after-ready=1");
  let status = await waitForExampleStatus<PointShadowStatus>(page);

  expect(status, "point shadow status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  status = await waitForPointShadowFrame(page, 3, true);
  await attachExampleStatus("point-shadow-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "point-shadow",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      shadowRequests: 1,
      diagnostics: 0,
    },
    shadow: {
      controls: {
        receiverEnabled: true,
        casterEnabled: true,
      },
      requests: [{ lightKind: "point" }],
      descriptor: {
        descriptors: [
          {
            lightKind: "point",
            faceCount: 6,
            viewDimension: "cube",
          },
        ],
      },
      depthTextureResources: {
        status: "available",
        resources: [
          {
            faceCount: 6,
            viewDimension: "cube",
            descriptor: { size: [512, 512, 6] },
          },
        ],
      },
      passPlan: {
        status: "ready",
        passCount: 6,
      },
      passAttachments: {
        status: "ready",
        attachmentCount: 6,
      },
      viewProjection: {
        status: "ready",
        planCount: 6,
      },
      matrixComputation: {
        status: "ready",
        matrixCount: 6,
      },
      matrixBufferResource: {
        status: "available",
        matrixCount: 6,
      },
      commandEncoding: {
        status: "ready",
        counts: {
          commandRecords: 6,
          drawCommands: 6,
        },
      },
      commandBufferSubmission: {
        status: "submitted",
      },
      rendering: {
        supported: true,
        mode: "point-depth-cube-compare",
        faceCount: 6,
        pipelineKey: "standard|pointShadowMap|opaque|back|less|none",
      },
    },
    draw: {
      drawCalls: 2,
      indexedDrawCalls: 2,
    },
  });
  expect(status.shadow?.textures.textures[0]?.attachmentViewKeys).toHaveLength(
    6,
  );
  expect(status.shadow?.passPlan.passes.map((pass) => pass.faceIndex)).toEqual([
    0, 1, 2, 3, 4, 5,
  ]);
  expect(
    status.shadow?.viewProjection.plans.map((plan) => plan.faceLabel),
  ).toEqual(["+x", "-x", "+y", "-y", "+z", "-z"]);
  expect(
    status.shadow?.commandEncoding.records.map((record) => record.depthViewKey),
  ).toEqual(
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys,
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("point-shadow-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisiblePointShadowScene(screenshot, status);
  webGpuValidation.expectNoWarnings();
});

test("Point cube-map shadows render visibly when casters are FOLDED into the single encoder (M3-T5)", async ({
  page,
}) => {
  // M3-T5 Done-when #1 (point): with ?graph=1 the example STOPS submitting its own
  // 6-face cube caster command buffer and hands the caster passes to the engine,
  // which renders them as depth-only graph nodes the forward (receiver) node reads —
  // ONE encoder. PIXEL proof the FOLDED casters produce shadows: the receiver wall
  // must darken vs a shadow-receiver-disabled baseline. Drive frames by COUNT, since
  // in graph mode status.shadow.rendering.supported is false (tied to the gated-off
  // separate submit).
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/point-shadow.html?graph=1&disable-shadow-receiver=1",
  );
  let status = await waitForExampleStatus<PointShadowStatus>(page);
  expect(status, "point folded baseline status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);
  await waitForPointShadowFrame(page, 3);
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/point-shadow.html?graph=1");
  status = await waitForExampleStatus<PointShadowStatus>(page);
  expect(status, "point folded shadow status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);
  status = await waitForPointShadowFrame(page, 3);
  expect(status.ok, "point folded-caster graph frame ok").toBe(true);
  expectStatusJsonSafeForGpu(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  expectVisiblePointShadowScene(screenshot, status);
  expectPointShadowActivation(noShadowScreenshot, screenshot, status);
  expectPointShadowNamedReceiverSamples(noShadowScreenshot, screenshot, status);
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

async function waitForPointShadowFrame(
  page: Parameters<typeof waitForExampleStatus>[0],
  minimumFrame: number,
  requireRendering = false,
): Promise<PointShadowStatus> {
  await page.waitForFunction(
    ({ minimumFrame, requireRendering }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: PointShadowStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: PointShadowStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectVisiblePointShadowScene(
  screenshot: Buffer,
  status: PointShadowStatus,
): void {
  const clear = clearPixel(status);
  const samples = {
    wall: strongestRegionSample(screenshot, clear, 0.42, 0.38, 0.78, 0.78),
    cube: strongestRegionSample(screenshot, clear, 0.42, 0.3, 0.58, 0.62),
    shadowReceiver: strongestRegionSample(
      screenshot,
      clear,
      0.55,
      0.52,
      0.74,
      0.76,
    ),
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

function expectPointShadowActivation(
  baseline: Buffer,
  shadowed: Buffer,
  status: PointShadowStatus,
): void {
  const clear = clearPixel(status);
  const region = pointShadowReceiverRegion();
  const baselineLuminance = averageRegionLuminance(baseline, clear, region);
  const shadowedLuminance = averageRegionLuminance(shadowed, clear, region);
  const maxDelta = maxRegionLuminanceDelta(baseline, shadowed, clear, region);

  expect(
    shadowedLuminance.visibleSamples,
    `shadow receiver region should contain visible samples; shadowed=${JSON.stringify(
      shadowedLuminance,
    )}`,
  ).toBeGreaterThanOrEqual(4);
  expect(
    maxDelta,
    `point shadow receiver region should change after cube-map sampling; baseline=${JSON.stringify(
      baselineLuminance,
    )} shadowed=${JSON.stringify(shadowedLuminance)} maxDelta=${maxDelta}`,
  ).toBeGreaterThan(8);
  expect(
    baselineLuminance.average - shadowedLuminance.average,
    `point shadow should visibly darken the receiver wall; baseline=${JSON.stringify(
      baselineLuminance,
    )} shadowed=${JSON.stringify(shadowedLuminance)}`,
  ).toBeGreaterThan(1);
}

function expectPointShadowNamedReceiverSamples(
  baseline: Buffer,
  shadowed: Buffer,
  status: PointShadowStatus,
): void {
  const clear = clearPixel(status);
  const samples = [
    {
      name: "near-light receiver",
      x: 0.42,
      y: 0.4,
      maxDelta: 110,
      minShadowedLuminance: 140,
    },
    {
      name: "mid receiver shadow",
      x: 0.58,
      y: 0.56,
      minDelta: 65,
      maxShadowedLuminance: 190,
    },
    {
      name: "far-side receiver shadow",
      x: 0.66,
      y: 0.56,
      minDelta: 40,
      maxShadowedLuminance: 150,
    },
  ] as const;

  for (const sample of samples) {
    const before = readPngPixel(baseline, sample.x, sample.y);
    const after = readPngPixel(shadowed, sample.x, sample.y);
    const beforeLuminance = luminance(before);
    const afterLuminance = luminance(after);
    const delta = beforeLuminance - afterLuminance;
    const label = `${sample.name} (${sample.x}, ${sample.y}) before=${JSON.stringify(
      before,
    )} after=${JSON.stringify(after)} delta=${delta}`;

    expect(pixelDistance(before, clear), label).toBeGreaterThan(20);
    expect(pixelDistance(after, clear), label).toBeGreaterThan(20);

    if ("maxDelta" in sample) {
      expect(delta, label).toBeLessThan(sample.maxDelta);
    }

    if ("minDelta" in sample) {
      expect(delta, label).toBeGreaterThan(sample.minDelta);
    }

    if ("minShadowedLuminance" in sample) {
      expect(afterLuminance, label).toBeGreaterThan(
        sample.minShadowedLuminance,
      );
    }

    if ("maxShadowedLuminance" in sample) {
      expect(afterLuminance, label).toBeLessThan(sample.maxShadowedLuminance);
    }
  }
}

function clearPixel(status: PointShadowStatus) {
  return status.clearColor === undefined
    ? { r: 4, g: 5, b: 7, a: 255 }
    : rgbaColorToPixel(status.clearColor);
}

function pointShadowReceiverRegion() {
  return { x0: 0.56, y0: 0.52, x1: 0.74, y1: 0.76 };
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
  region: ReturnType<typeof pointShadowReceiverRegion>,
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
  region: ReturnType<typeof pointShadowReceiverRegion>,
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
