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
  };
  readonly transparentSort?: readonly {
    readonly renderId: number;
    readonly materialKey: string;
    readonly order: number;
    readonly depth: number;
    readonly stableId: number;
  }[];
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
      drawCalls: 8,
      diagnostics: 0,
    },
  });
  expect(status.transparentSortPolicy).toMatchObject({
    name: "transparent-order-back-to-front-stable",
    depthOrder: "back-to-front",
    tieBreakers: expect.arrayContaining(["stableId", "sortOrdinal"]),
    totalOrder: true,
  });
  expect(status.commandPressure?.drawCommands).toBe(8);
  expect(status.commandPressure?.stateCommands.planned ?? 0).toBeGreaterThan(
    status.commandPressure?.stateCommands.emitted ?? Number.POSITIVE_INFINITY,
  );
  expect(status.commandPressure?.stateCommands.elided ?? 0).toBeGreaterThan(0);
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
  ).toBeLessThan(90);
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
