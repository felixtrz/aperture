import { expect, test, type Page } from "@playwright/test";

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

test("Playwright encodes and submits directional CSM shadow passes", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/csm-directional-shadow.html?stop-after-ready=1");
  let status = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);

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
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

test("CSM directional shadows render visibly when casters are FOLDED into the single encoder (M3-T5)", async ({
  page,
}) => {
  // M3-T5 Done-when #1 (csm): with ?graph=1 the example STOPS submitting its own
  // caster command buffer and hands the caster passes to the engine, which renders
  // them as depth-only graph nodes the forward (receiver) node reads — ONE encoder.
  // This is the PIXEL proof that the FOLDED casters actually produce shadows
  // (ok:true alone cannot show that): the receiver regions must darken vs a
  // shadow-receiver-disabled baseline, exactly like the legacy separate-submit test.
  //
  // NB: in graph mode the example's own caster submit is gated off, so
  // status.shadow.rendering.supported (tied to that submit path) is false — drive
  // frames by COUNT, not that flag, and let the pixel diff be the proof.
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/csm-directional-shadow.html?graph=1&disable-shadow-receiver=1",
  );
  let status = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);
  expect(status, "CSM folded baseline status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);
  await waitForCsmDirectionalShadowFrame(page, 3);
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/csm-directional-shadow.html?graph=1");
  status = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);
  expect(status, "CSM folded shadow status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);
  status = await waitForCsmDirectionalShadowFrame(page, 3);
  expect(status.ok, "csm folded-caster graph frame ok").toBe(true);
  expectStatusJsonSafeForGpu(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  expectVisibleCsmScene(screenshot, status);
  expectCsmShadowActivation(noShadowScreenshot, screenshot, status);
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

test("CSM shadow-receiver forward route renders through the single-encoder FrameGraph (M3-T4)", async ({
  page,
}) => {
  // M3-T4 Done-when #4: with ?graph=1 the forward (shadow-receiver) frame is
  // encoded into ONE command buffer; the receiver pass still samples the shadow
  // maps written by the separate caster passes and renders with no validation
  // warnings (shadows-as-receiver through the graph).
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/csm-directional-shadow.html?graph=1");

  const initial = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);
  expect(initial, "csm graph status should publish").toBeDefined();
  if (initial === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(initial);

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3,
  );

  const rendered = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);
  expect(rendered?.ok).toBe(true);
  expectStatusJsonSafeForGpu(rendered);
  webGpuValidation.expectNoWarnings();
  await page.goto("about:blank");
});

test("M4-T4: authored shadow strength reaches full darkness (strength=1) and disappears (strength=0)", async ({
  page,
}) => {
  // No-shadow baseline: identical geometry, receiver simply does not sample
  // the shadow map → lit receiver (disable-shadow-receiver, not -caster, so the
  // caster box still renders and only the shadow is removed).
  const baseline = await captureCsmStrengthFrame(
    page,
    "graph=1&disable-shadow-receiver=1",
    false,
  );
  if (baseline === null) {
    return;
  }
  // Full strength: fully-occluded receiver reaches near-black (below the old
  // 0.45 MIN_VISIBILITY floor, which is now gone).
  const strong = await captureCsmStrengthFrame(
    page,
    "graph=1&shadow-strength=1.0",
    false,
  );
  if (strong === null) {
    return;
  }
  // Zero strength: shadow factor is 1 everywhere → frame matches the baseline.
  const none = await captureCsmStrengthFrame(
    page,
    "graph=1&shadow-strength=0.0",
    false,
  );
  if (none === null) {
    return;
  }

  const clear = clearPixel(baseline.status);
  const regions = [
    { name: "near cascade receiver", x0: 0.24, y0: 0.34, x1: 0.54, y1: 0.72 },
    { name: "far cascade receiver", x0: 0.52, y0: 0.36, x1: 0.82, y1: 0.74 },
  ] as const;

  let strongDelta = 0;
  let zeroDelta = 0;
  for (const region of regions) {
    strongDelta = Math.max(
      strongDelta,
      maxRegionLuminanceDelta(baseline.shot, strong.shot, clear, region),
    );
    zeroDelta = Math.max(
      zeroDelta,
      maxRegionLuminanceDelta(baseline.shot, none.shot, clear, region),
    );
  }

  // strength=1 darkens the shadowed receiver far more than strength=0, and well
  // beyond the previous 0.45-clamped result.
  expect(
    strongDelta,
    `strength=1 should darken the shadowed receiver strongly (delta=${strongDelta})`,
  ).toBeGreaterThan(40);
  // strength=0 leaves the frame ~identical to the no-shadow baseline.
  expect(
    zeroDelta,
    `strength=0 should match the no-shadow baseline (delta=${zeroDelta})`,
  ).toBeLessThan(15);
  expect(
    strongDelta,
    `authored strength must clearly modulate shadow darkness (strong=${strongDelta} zero=${zeroDelta})`,
  ).toBeGreaterThan(zeroDelta + 25);

  await page.goto("about:blank");
});

async function captureCsmStrengthFrame(
  page: Page,
  query: string,
  requireRendering = true,
): Promise<{
  readonly shot: Buffer;
  readonly status: CsmDirectionalShadowStatus;
} | null> {
  await page.goto(`/examples/csm-directional-shadow.html?${query}`);
  let status = await waitForExampleStatus<CsmDirectionalShadowStatus>(page);
  expect(
    status,
    `CSM strength status should publish for ${query}`,
  ).toBeDefined();
  if (status === undefined) {
    return null;
  }
  skipIfUnsupportedWebGpu(status);
  status = await waitForCsmDirectionalShadowFrame(page, 3, requireRendering);
  const shot = await page.locator("#aperture-canvas").screenshot();
  return { shot, status };
}

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
