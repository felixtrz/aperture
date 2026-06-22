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

interface OutdoorSceneStatus extends ExampleStatusBase {
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
  readonly areaLight?: {
    readonly enabled: boolean;
    readonly kind: "rect-area";
    readonly width: number;
    readonly height: number;
    readonly intensity: number;
    readonly submitted: boolean;
    readonly lightGpuBuffers: number;
  };
  readonly environment?: {
    readonly enabled: boolean;
    readonly ready: boolean;
    readonly diffuseTextureStatus: string | null;
    readonly specularTextureStatus: string | null;
    readonly samplerStatus: string | null;
    readonly bindGroupStatus: string | null;
  };
  readonly shadow?: {
    readonly controls: {
      readonly receiverEnabled: boolean;
      readonly casterEnabled: boolean;
    };
    readonly requests: readonly {
      readonly lightKind: string;
      readonly cascadeCount: number;
    }[];
    readonly depthTextureResources: {
      readonly status: string;
      readonly resources: readonly {
        readonly layerCount: number;
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
        readonly cascadeIndex: number;
        readonly cascadeCount: number;
      }[];
    };
    readonly matrixComputation: {
      readonly status: string;
      readonly matrixCount: number;
    };
    readonly commandEncoding: {
      readonly status: string;
      readonly counts: {
        readonly commandRecords: number;
        readonly drawCommands: number;
      };
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
      readonly cascadeCount: number;
      readonly pipelineKey: string | null;
    };
  };
  readonly draw?: {
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

test("Playwright renders an outdoor scene with CSM and RectAreaLight", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/outdoor-scene.html?disable-shadow-receiver=1");
  let status = await waitForExampleStatus<OutdoorSceneStatus>(page);

  expect(status, "outdoor baseline status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  await waitForOutdoorSceneFrame(page, 3);
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/outdoor-scene.html?disable-area-light=1");
  status = await waitForExampleStatus<OutdoorSceneStatus>(page);

  expect(status, "outdoor no-area status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  await waitForOutdoorSceneFrame(page, 3, true);
  const noAreaScreenshot = await page.locator("#aperture-canvas").screenshot();

  await page.goto("/examples/outdoor-scene.html?disable-ibl=1");
  status = await waitForExampleStatus<OutdoorSceneStatus>(page);

  expect(status, "outdoor no-IBL status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  await waitForOutdoorSceneFrame(page, 3, true);
  const noIblScreenshot = await page.locator("#aperture-canvas").screenshot();

  await page.goto("/examples/outdoor-scene.html?stop-after-ready=1");
  status = await waitForExampleStatus<OutdoorSceneStatus>(page);

  expect(status, "outdoor scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  status = await waitForOutdoorSceneFrame(page, 2, true);
  await attachExampleStatus("outdoor-scene-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "outdoor-scene",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 5,
      lights: 3,
      shadowRequests: 1,
      diagnostics: 0,
    },
    areaLight: {
      enabled: true,
      kind: "rect-area",
      width: 1.65,
      height: 1.05,
      submitted: true,
    },
    environment: {
      enabled: true,
      ready: true,
      diffuseTextureStatus: "available",
      specularTextureStatus: "available",
      samplerStatus: "available",
      bindGroupStatus: "available",
    },
    shadow: {
      controls: {
        receiverEnabled: true,
        casterEnabled: true,
      },
      requests: [{ lightKind: "directional", cascadeCount: 4 }],
      depthTextureResources: {
        status: "available",
        resources: [
          {
            layerCount: 4,
            faceCount: 1,
            viewDimension: "2d-array",
            descriptor: { size: [1024, 1024, 4] },
          },
        ],
      },
      passPlan: {
        status: "ready",
        passCount: 4,
      },
      matrixComputation: {
        status: "ready",
        matrixCount: 4,
      },
      commandEncoding: {
        status: "ready",
        counts: {
          commandRecords: 4,
          drawCommands: 8,
        },
      },
      encoderAssembly: {
        status: "ready",
        counts: {
          assembledPasses: 4,
          drawCalls: 8,
        },
      },
      commandBufferSubmission: {
        status: "submitted",
      },
      rendering: {
        supported: true,
        mode: "directional-csm-depth-array-plus-ibl",
        cascadeCount: 4,
      },
    },
    draw: {
      drawCalls: 5,
      indexedDrawCalls: 5,
    },
  });
  expect(status.areaLight?.lightGpuBuffers).toBeGreaterThanOrEqual(3);
  expect(status.shadow?.rendering.pipelineKey).toContain("cascadedShadowMap");
  expect(status.shadow?.rendering.pipelineKey).toContain("iblDiffuse");
  expect(status.shadow?.rendering.pipelineKey).toContain("iblSpecularProof");
  expect(
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys,
  ).toHaveLength(4);
  expect(
    status.shadow?.passPlan.passes.map((pass) => pass.cascadeIndex),
  ).toEqual([0, 1, 2, 3]);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("outdoor-scene-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleOutdoorScene(screenshot, status);
  expectCsmShadowActivation(noShadowScreenshot, screenshot, status);
  expectAreaLightActivation(noAreaScreenshot, screenshot, status);
  expectIblActivation(noIblScreenshot, screenshot, status);
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

async function waitForOutdoorSceneFrame(
  page: Parameters<typeof waitForExampleStatus>[0],
  minimumFrame: number,
  requireRendering = false,
): Promise<OutdoorSceneStatus> {
  await page.waitForFunction(
    ({ minimumFrame, requireRendering }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: OutdoorSceneStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: OutdoorSceneStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectVisibleOutdoorScene(
  screenshot: Buffer,
  status: OutdoorSceneStatus,
): void {
  const clear = clearPixel(status);
  const samples = {
    nearReceiver: strongestRegionSample(
      screenshot,
      clear,
      0.25,
      0.28,
      0.55,
      0.78,
    ),
    farReceiver: strongestRegionSample(
      screenshot,
      clear,
      0.52,
      0.3,
      0.83,
      0.78,
    ),
    areaReceiver: strongestRegionSample(
      screenshot,
      clear,
      0.14,
      0.28,
      0.36,
      0.76,
    ),
  };

  for (const [name, sample] of Object.entries(samples)) {
    expect(
      pixelDistance(sample, clear),
      `${name} should contain non-clear pixels; sample=${JSON.stringify(
        sample,
      )}`,
    ).toBeGreaterThan(20);
  }
}

function expectCsmShadowActivation(
  baseline: Buffer,
  shadowed: Buffer,
  status: OutdoorSceneStatus,
): void {
  const clear = clearPixel(status);
  const regions = [
    {
      name: "near outdoor receiver",
      region: { x0: 0.25, y0: 0.34, x1: 0.54, y1: 0.72 },
    },
    {
      name: "far outdoor receiver",
      region: { x0: 0.53, y0: 0.36, x1: 0.83, y1: 0.74 },
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
      `${name} should change after cascaded shadow sampling; maxDelta=${maxDelta}`,
    ).toBeGreaterThan(10);
  }
}

function expectAreaLightActivation(
  baseline: Buffer,
  lit: Buffer,
  status: OutdoorSceneStatus,
): void {
  const clear = clearPixel(status);
  const region = { x0: 0.24, y0: 0.46, x1: 0.39, y1: 0.74 };
  const baselineLuminance = averageRegionLuminance(baseline, clear, region);
  const litLuminance = averageRegionLuminance(lit, clear, region);
  const maxDelta = maxRegionLuminanceDelta(baseline, lit, clear, region);

  expect(
    litLuminance.visibleSamples,
    `area-lit window receiver should contain visible samples; lit=${JSON.stringify(
      litLuminance,
    )}`,
  ).toBeGreaterThanOrEqual(4);
  expect(
    litLuminance.average,
    `RectAreaLight should brighten the window receiver; baseline=${JSON.stringify(
      baselineLuminance,
    )} lit=${JSON.stringify(litLuminance)}`,
  ).toBeGreaterThan(baselineLuminance.average + 5);
  expect(
    maxDelta,
    `RectAreaLight should visibly change the left receiver; maxDelta=${maxDelta}`,
  ).toBeGreaterThan(8);
}

function expectIblActivation(
  baseline: Buffer,
  ibl: Buffer,
  status: OutdoorSceneStatus,
): void {
  const clear = clearPixel(status);
  const receiverRegion = { x0: 0.24, y0: 0.34, x1: 0.82, y1: 0.74 };
  const maxDelta = maxRegionLuminanceDelta(
    baseline,
    ibl,
    clear,
    receiverRegion,
  );

  expect(
    maxDelta,
    `IBL should visibly change the CSM receiver route; maxDelta=${maxDelta}`,
  ).toBeGreaterThan(5);
}

function clearPixel(status: OutdoorSceneStatus) {
  return status.clearColor === undefined
    ? { r: 4, g: 6, b: 9, a: 255 }
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
