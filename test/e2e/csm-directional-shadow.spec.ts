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

interface CsmDirectionalShadowStatus extends ExampleStatusBase {
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
      readonly cascadeCount: number;
      readonly shadowType?: number;
      readonly strength?: number;
      readonly filterRadius?: number;
      readonly slopeBias?: number;
    }[];
    readonly descriptor: {
      readonly descriptors: readonly {
        readonly lightKind: string;
        readonly cascadeCount: number;
        readonly faceCount: number;
        readonly viewDimension: string;
      }[];
    };
    readonly textures: {
      readonly textures: readonly {
        readonly cascadeCount: number;
        readonly layerCount: number;
        readonly faceCount: number;
        readonly viewDimension: string;
        readonly attachmentViewKeys: readonly string[];
      }[];
    };
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
        readonly lightKind: string;
        readonly cascadeIndex: number;
        readonly cascadeCount: number;
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
        readonly cascadeIndex: number;
        readonly cascadeCount: number;
        readonly passKey: string;
      }[];
    };
    readonly matrixComputation: {
      readonly status: string;
      readonly matrixCount: number;
      readonly matrices: readonly {
        readonly cascadeIndex: number;
        readonly cascadeCount: number;
      }[];
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
      readonly cascadeCount: number;
      readonly pipelineKey: string | null;
    };
  };
  readonly draw?: {
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

test("Playwright renders directional CSM shadows on near and far receivers", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/csm-directional-shadow.html?disable-shadow-receiver=1",
  );
  let status = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);

  expect(status, "CSM baseline status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  await waitForCsmDirectionalShadowFrame(page, 3);
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/csm-directional-shadow.html?stop-after-ready=1");
  status = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);

  expect(status, "CSM shadow status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  status = await waitForCsmDirectionalShadowFrame(page, 3, true);
  await attachExampleStatus("csm-directional-shadow-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "csm-directional-shadow",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-explicit",
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
        casterEnabled: true,
      },
      requests: [{ lightKind: "directional", cascadeCount: 4 }],
      descriptor: {
        descriptors: [
          {
            lightKind: "directional",
            cascadeCount: 4,
            faceCount: 1,
            viewDimension: "2d-array",
          },
        ],
      },
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
      passAttachments: {
        status: "ready",
        attachmentCount: 4,
      },
      viewProjection: {
        status: "ready",
        planCount: 4,
      },
      matrixComputation: {
        status: "ready",
        matrixCount: 4,
      },
      matrixBufferResource: {
        status: "available",
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
        mode: "directional-csm-depth-array-compare",
        cascadeCount: 4,
      },
    },
    draw: {
      drawCalls: 4,
      indexedDrawCalls: 4,
    },
  });
  expect(status.shadow?.rendering.pipelineKey).toContain("cascadedShadowMap");
  expect(status.shadow?.textures.textures[0]?.attachmentViewKeys).toHaveLength(
    4,
  );
  expect(
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys,
  ).toHaveLength(4);
  expect(
    status.shadow?.passPlan.passes.map((pass) => pass.cascadeIndex),
  ).toEqual([0, 1, 2, 3]);
  expect(
    status.shadow?.viewProjection.plans.map((plan) => plan.cascadeIndex),
  ).toEqual([0, 1, 2, 3]);
  expect(
    status.shadow?.matrixComputation.matrices.map(
      (matrix) => matrix.cascadeIndex,
    ),
  ).toEqual([0, 1, 2, 3]);
  expect(
    status.shadow?.commandEncoding.records.map((record) => record.depthViewKey),
  ).toEqual([
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys[0],
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys[1],
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys[2],
    status.shadow?.depthTextureResources.resources[0]?.attachmentViewKeys[3],
  ]);

  // M4-T3: the authored shadowType/strength/filterRadius/slopeBias flow
  // through ECS -> extraction -> packed worker codec -> route status, JSON-safe.
  const shadowRequest = status.shadow?.requests[0];
  expect(shadowRequest?.shadowType).toBe(2);
  expect(shadowRequest?.strength).toBeCloseTo(0.9, 4);
  expect(shadowRequest?.filterRadius).toBeCloseTo(2, 4);
  expect(shadowRequest?.slopeBias).toBeCloseTo(0.5, 4);
  expect(JSON.stringify(status.shadow?.requests)).not.toMatch(
    /NaN|Infinity|undefined/,
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("csm-directional-shadow-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleCsmScene(screenshot, status);
  expectCsmShadowActivation(noShadowScreenshot, screenshot, status);
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

async function waitForCsmDirectionalShadowFrame(
  page: Parameters<typeof waitForExampleStatus>[0],
  minimumFrame: number,
  requireRendering = false,
): Promise<CsmDirectionalShadowStatus> {
  await page.waitForFunction(
    ({ minimumFrame, requireRendering }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: CsmDirectionalShadowStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: CsmDirectionalShadowStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectVisibleCsmScene(
  screenshot: Buffer,
  status: CsmDirectionalShadowStatus,
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

function expectCsmShadowActivation(
  baseline: Buffer,
  shadowed: Buffer,
  status: CsmDirectionalShadowStatus,
): void {
  const clear = clearPixel(status);
  const regions = [
    {
      name: "near cascade receiver",
      region: { x0: 0.24, y0: 0.34, x1: 0.54, y1: 0.72 },
    },
    {
      name: "far cascade receiver",
      region: { x0: 0.52, y0: 0.36, x1: 0.82, y1: 0.74 },
    },
  ] as const;

  for (const { name, region } of regions) {
    const baselineLuminance = averageRegionLuminance(baseline, clear, region);
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
      `${name} should change after cascaded array shadow sampling; baseline=${JSON.stringify(
        baselineLuminance,
      )} shadowed=${JSON.stringify(shadowedLuminance)} maxDelta=${maxDelta}`,
    ).toBeGreaterThan(10);
  }
}

function clearPixel(status: CsmDirectionalShadowStatus) {
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
