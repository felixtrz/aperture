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
    readonly transparentDepthTieBreak: readonly [
      number,
      number,
      number,
      number,
    ];
    readonly transparentStableTieBreak: readonly [
      number,
      number,
      number,
      number,
    ];
  };
  readonly materialKeys?: {
    readonly transparentDepthBack?: string;
    readonly transparentDepthFront?: string;
    readonly transparentStableFirst?: string;
    readonly transparentStableLast?: string;
    readonly transparentPressure?: readonly string[];
  };
  readonly transparentSort?: readonly {
    readonly renderId: number;
    readonly materialKey: string;
    readonly viewId: number;
    readonly layer: number;
    readonly order: number;
    readonly depth: number;
    readonly stableId: number;
  }[];
  readonly transparentPressure?: {
    readonly enabled: boolean;
    readonly ready: boolean;
    readonly recordCount: number;
    readonly expectedRecordCount: number;
    readonly depthOrderInversions: number;
    readonly renderOrderTieBreakCount: number;
    readonly stableIdTieBreakCount: number;
    readonly cameraPhase: string;
    readonly cameraX: number;
    readonly cameraMoved: boolean;
    readonly overlapRegions: readonly string[];
    readonly orderSignature: string;
  } | null;
  readonly routeTransparentPressureReady?: boolean;
  readonly transparentSortPolicy?: {
    readonly name: string;
    readonly depthOrder: string;
    readonly tieBreakers: readonly string[];
    readonly totalOrder: boolean;
  } | null;
  readonly commandPressure?: {
    readonly resolvedDraws: number;
    readonly drawCommands: number;
    readonly stateCommands: {
      readonly planned: number;
      readonly emitted: number;
      readonly elided: number;
      readonly setPipeline: {
        readonly planned: number;
        readonly emitted: number;
        readonly elided: number;
      };
      readonly setBindGroup: {
        readonly planned: number;
        readonly emitted: number;
        readonly elided: number;
      };
      readonly setVertexBuffer: {
        readonly planned: number;
        readonly emitted: number;
        readonly elided: number;
      };
      readonly setIndexBuffer: {
        readonly planned: number;
        readonly emitted: number;
        readonly elided: number;
      };
    };
  } | null;
  readonly queueStateSort?: {
    readonly phase: "opaque";
    readonly policy: string;
    readonly recordCount: number;
    readonly stableOrder: {
      readonly pipeline: number;
      readonly materialResource: number;
      readonly meshLayout: number;
      readonly meshResource: number;
      readonly total: number;
    };
    readonly stateAwareOrder: {
      readonly pipeline: number;
      readonly materialResource: number;
      readonly meshLayout: number;
      readonly meshResource: number;
      readonly total: number;
    };
    readonly delta: {
      readonly pipeline: number;
      readonly materialResource: number;
      readonly meshLayout: number;
      readonly meshResource: number;
      readonly total: number;
    };
  } | null;
  readonly queuedBindGroups?: {
    readonly created: number;
    readonly reused: number;
    readonly cacheSize: number;
  };
  readonly renderBundles?: {
    readonly created: number;
    readonly reused: number;
    readonly unsupported: number;
    readonly failed: number;
    readonly disabled: number;
    readonly encodedCommands: number;
    readonly executedBundles: number;
    readonly drawCalls: number;
    readonly reports: readonly {
      readonly status: string;
      readonly commandCount: number;
      readonly encodedCommands: number;
      readonly executedBundles: number;
      readonly drawCalls: number;
    }[];
  } | null;
  readonly renderBundleHistory?: {
    readonly created: number;
    readonly reused: number;
    readonly unsupported: number;
    readonly failed: number;
    readonly disabled: number;
    readonly encodedCommands: number;
    readonly executedBundles: number;
    readonly drawCalls: number;
    readonly reports: readonly {
      readonly status: string;
      readonly commandCount: number;
      readonly encodedCommands: number;
      readonly executedBundles: number;
      readonly drawCalls: number;
    }[];
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly report?: {
    readonly resourceReuse?: {
      readonly bindGroupsCreated?: number;
      readonly bindGroupsReused?: number;
      readonly preparedMaterialCache?: {
        readonly totalEntries?: number;
      };
    };
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
    queues: [
      "opaque",
      "opaque",
      "opaque",
      "alpha-test",
      "transparent",
      "transparent",
      "transparent",
      "transparent",
    ],
    pipelineKeys: [
      "standard|opaque|none|less|none",
      "standard|opaque|none|less|none",
      "standard|opaque|none|less|none",
      "standard|mask|none|less|none",
      "standard|blend|none|less|alpha",
      "standard|blend|none|less|alpha",
      "standard|blend|none|less|alpha",
      "standard|blend|none|less|alpha",
    ],
    counts: {
      meshDraws: 8,
      diagnostics: 0,
    },
  });
  expect(status.counts?.drawCalls ?? 0).toBeGreaterThanOrEqual(7);
  expect(status.transparentSortPolicy).toMatchObject({
    name: "transparent-order-back-to-front-stable",
    depthOrder: "back-to-front",
    tieBreakers: expect.arrayContaining(["stableId", "sortOrdinal"]),
    totalOrder: true,
  });
  expect(status.commandPressure?.drawCommands ?? 0).toBeGreaterThanOrEqual(7);
  expect(status.queueStateSort).toMatchObject({
    phase: "opaque",
    policy: "opaque-state-resource-front-to-back-stable",
    recordCount: 4,
  });
  expect(status.queueStateSort?.delta.pipeline ?? 0).toBeGreaterThan(0);
  expect(status.queueStateSort?.delta.total ?? 0).toBeGreaterThan(0);
  expect(
    (status.queuedBindGroups?.created ?? 0) +
      (status.queuedBindGroups?.reused ?? 0) +
      (status.report?.resourceReuse?.bindGroupsCreated ?? 0) +
      (status.report?.resourceReuse?.bindGroupsReused ?? 0),
  ).toBeGreaterThan(0);
  expect(
    status.report?.resourceReuse?.preparedMaterialCache?.totalEntries ?? 0,
  ).toBeGreaterThan(0);
  expect(status.commandPressure?.stateCommands.planned ?? 0).toBeGreaterThan(
    status.commandPressure?.stateCommands.emitted ?? Number.POSITIVE_INFINITY,
  );
  expect(status.commandPressure?.stateCommands.elided ?? 0).toBeGreaterThan(0);
  expect(status.renderBundleHistory?.created ?? 0).toBeGreaterThan(0);
  expect(status.renderBundleHistory?.failed ?? 0).toBe(0);
  expect(status.transparentSort?.map((entry) => entry.materialKey)).toEqual([
    status.materialKeys?.transparentDepthBack,
    status.materialKeys?.transparentDepthFront,
    status.materialKeys?.transparentStableFirst,
    status.materialKeys?.transparentStableLast,
  ]);
  expect(status.transparentSort?.[0]?.order).toBe(2);
  expect(status.transparentSort?.[1]?.order).toBe(2);
  expect(status.transparentSort?.[0]?.depth ?? 0).toBeGreaterThan(
    status.transparentSort?.[1]?.depth ?? 0,
  );
  expect(status.transparentSort?.[2]?.order).toBe(5);
  expect(status.transparentSort?.[3]?.order).toBe(5);
  expect(status.transparentSort?.[2]?.depth ?? Number.NaN).toBeCloseTo(
    status.transparentSort?.[3]?.depth ?? Number.NaN,
    5,
  );
  expect(status.transparentSort?.[2]?.stableId ?? 0).toBeLessThan(
    status.transparentSort?.[3]?.stableId ?? 0,
  );

  const renderedStatus = await waitForQueuePhaseFrame(
    page,
    Math.max((status.frame ?? 0) + 2, 3),
  );
  await attachExampleStatus(
    "standard-queue-phases-rendered-status",
    renderedStatus,
  );
  expectStatusJsonSafeForGpu(renderedStatus);
  expect(renderedStatus.renderBundleHistory?.created ?? 0).toBeGreaterThan(0);
  expect(renderedStatus.renderBundleHistory?.reused ?? 0).toBeGreaterThan(0);
  expect(renderedStatus.renderBundles).toMatchObject({
    reused: expect.any(Number),
    failed: 0,
    encodedCommands: 0,
    executedBundles: expect.any(Number),
  });
  expect(renderedStatus.renderBundles?.drawCalls ?? 0).toBeGreaterThanOrEqual(
    7,
  );
  expect(renderedStatus.renderBundles?.reused ?? 0).toBeGreaterThan(0);
  webGpuValidation.expectNoWarnings();

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("standard-queue-phases.png", {
    body: screenshot,
    contentType: "image/png",
  });

  const alphaCutout = strongestRegionSample(screenshot, 0.38, 0.43, 0.5, 0.66);
  const transparentDepthTieBreak = strongestRegionSample(
    screenshot,
    0.45,
    0.43,
    0.56,
    0.66,
  );
  const transparentStableTieBreak = strongestRegionSample(
    screenshot,
    0.54,
    0.43,
    0.68,
    0.66,
  );
  const expectedAlphaCutout = rgbaTupleToPixel(
    renderedStatus.expectedSamples?.alphaCutout ?? [0.95, 0.08, 0.04, 1],
  );
  const expectedTransparentDepthTieBreak = rgbaTupleToPixel(
    renderedStatus.expectedSamples?.transparentDepthTieBreak ?? [
      0.56, 0.28, 0.2, 1,
    ],
  );
  const expectedTransparentStableTieBreak = rgbaTupleToPixel(
    renderedStatus.expectedSamples?.transparentStableTieBreak ?? [
      0.56, 0.28, 0.2, 1,
    ],
  );
  const clear = rgbaColorToPixel(
    renderedStatus.clearColor ?? { r: 0.02, g: 0.025, b: 0.03, a: 1 },
  );

  expect(
    pixelDistance(alphaCutout, expectedAlphaCutout),
    `alpha-test cutout should reveal opaque red behind it; sample=${JSON.stringify(
      alphaCutout,
    )}`,
  ).toBeLessThan(130);
  expect(alphaCutout.r).toBeGreaterThan(alphaCutout.g + 80);
  expect(alphaCutout.r).toBeGreaterThan(alphaCutout.b + 120);
  expect(pixelDistance(alphaCutout, clear)).toBeGreaterThan(80);

  expect(
    pixelDistance(transparentDepthTieBreak, expectedTransparentDepthTieBreak),
    `transparent depth tie-break should put the nearer red surface over green; sample=${JSON.stringify(
      transparentDepthTieBreak,
    )}`,
  ).toBeLessThan(140);
  expect(pixelDistance(transparentDepthTieBreak, clear)).toBeGreaterThan(70);
  expect(transparentDepthTieBreak.r).toBeGreaterThan(
    transparentDepthTieBreak.g + 20,
  );

  expect(
    pixelDistance(transparentStableTieBreak, expectedTransparentStableTieBreak),
    `transparent stable-id tie-break should put the later stable red surface over green; sample=${JSON.stringify(
      transparentStableTieBreak,
    )}`,
  ).toBeLessThan(140);
  expect(pixelDistance(transparentStableTieBreak, clear)).toBeGreaterThan(70);
  expect(transparentStableTieBreak.r).toBeGreaterThan(
    transparentStableTieBreak.g + 20,
  );
});

test("transparent pressure route keeps dense alpha-blend records back-to-front across a camera move", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-queue-phases.html?transparent-pressure=1",
  );

  const initialStatus =
    await waitForExampleStatus<StandardQueuePhasesStatus>(page);

  await attachExampleStatus(
    "standard-queue-transparent-pressure-initial",
    initialStatus,
  );
  expect(initialStatus).toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  const beforeMove =
    initialStatus.routeTransparentPressureReady === true &&
    initialStatus.transparentPressure?.cameraPhase ===
      "before-small-camera-move"
      ? initialStatus
      : await waitForTransparentPressurePhase(page, "before-small-camera-move");

  await attachExampleStatus(
    "standard-queue-transparent-pressure-before",
    beforeMove,
  );
  expectStatusJsonSafeForGpu(beforeMove);
  expect(beforeMove.routeTransparentPressureReady).toBe(true);
  expect(beforeMove.transparentPressure).toMatchObject({
    enabled: true,
    ready: true,
    recordCount: 32,
    expectedRecordCount: 32,
    depthOrderInversions: 0,
    cameraPhase: "before-small-camera-move",
    cameraMoved: false,
  });
  expect(
    beforeMove.transparentPressure?.renderOrderTieBreakCount ?? 0,
  ).toBeGreaterThan(0);
  expect(
    beforeMove.transparentPressure?.stableIdTieBreakCount ?? 0,
  ).toBeGreaterThan(0);
  expect(beforeMove.counts).toMatchObject({
    meshDraws: 32,
    drawCalls: 32,
    diagnostics: 0,
  });
  expect(beforeMove.transparentSortPolicy).toMatchObject({
    name: "transparent-order-back-to-front-stable",
    depthOrder: "back-to-front",
    totalOrder: true,
  });

  const beforeScreenshot = await page.locator("#aperture-canvas").screenshot();
  const beforeSamples = transparentPressureSamples(beforeScreenshot);

  await test.info().attach("standard-queue-transparent-pressure-before.png", {
    body: beforeScreenshot,
    contentType: "image/png",
  });

  const afterMove = await waitForTransparentPressurePhase(
    page,
    "after-small-camera-move",
  );

  await attachExampleStatus(
    "standard-queue-transparent-pressure-after",
    afterMove,
  );
  expectStatusJsonSafeForGpu(afterMove);
  expect(afterMove.routeTransparentPressureReady).toBe(true);
  expect(afterMove.transparentPressure).toMatchObject({
    enabled: true,
    ready: true,
    recordCount: 32,
    expectedRecordCount: 32,
    depthOrderInversions: 0,
    cameraPhase: "after-small-camera-move",
    cameraMoved: true,
  });
  expect(afterMove.transparentPressure?.orderSignature).toBe(
    beforeMove.transparentPressure?.orderSignature,
  );

  const afterScreenshot = await page.locator("#aperture-canvas").screenshot();
  const afterSamples = transparentPressureSamples(afterScreenshot);

  await test.info().attach("standard-queue-transparent-pressure-after.png", {
    body: afterScreenshot,
    contentType: "image/png",
  });

  const clear = rgbaColorToPixel(
    afterMove.clearColor ?? { r: 0.02, g: 0.025, b: 0.03, a: 1 },
  );

  for (const region of [
    "depthStackLeft",
    "renderOrderCenter",
    "stableIdRight",
  ] as const) {
    const beforeSample = beforeSamples[region];
    const afterSample = afterSamples[region];

    expect(
      pixelDistance(beforeSample, clear),
      `${region} before camera move should contain alpha-blended geometry; sample=${JSON.stringify(
        beforeSample,
      )}`,
    ).toBeGreaterThan(60);
    expect(
      pixelDistance(afterSample, clear),
      `${region} after camera move should contain alpha-blended geometry; sample=${JSON.stringify(
        afterSample,
      )}`,
    ).toBeGreaterThan(60);
    expect(dominantChannel(afterSample)).toBe(dominantChannel(beforeSample));
  }

  webGpuValidation.expectNoWarnings();
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

  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const sample = readPngPixel(
        screenshot,
        minX + ((maxX - minX) * x) / 8,
        minY + ((maxY - minY) * y) / 8,
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

function transparentPressureSamples(screenshot: Buffer): {
  readonly depthStackLeft: ReturnType<typeof readPngPixel>;
  readonly renderOrderCenter: ReturnType<typeof readPngPixel>;
  readonly stableIdRight: ReturnType<typeof readPngPixel>;
} {
  return {
    depthStackLeft: strongestRegionSample(screenshot, 0.27, 0.38, 0.44, 0.64),
    renderOrderCenter: strongestRegionSample(
      screenshot,
      0.42,
      0.28,
      0.58,
      0.55,
    ),
    stableIdRight: strongestRegionSample(screenshot, 0.55, 0.45, 0.73, 0.72),
  };
}

function dominantChannel(pixel: ReturnType<typeof readPngPixel>): string {
  if (pixel.r >= pixel.g && pixel.r >= pixel.b) {
    return "r";
  }

  if (pixel.g >= pixel.r && pixel.g >= pixel.b) {
    return "g";
  }

  return "b";
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

async function waitForTransparentPressurePhase(
  page: Page,
  cameraPhase: string,
): Promise<StandardQueuePhasesStatus> {
  await page.waitForFunction((phase) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: StandardQueuePhasesStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return (
      status?.ok === true &&
      status.routeTransparentPressureReady === true &&
      status.transparentPressure?.cameraPhase === phase
    );
  }, cameraPhase);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: StandardQueuePhasesStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as StandardQueuePhasesStatus,
  );
}
