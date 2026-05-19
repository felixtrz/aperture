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

interface MultiLightShadowStatus extends ExampleStatusBase {
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
    readonly requests: readonly {
      readonly lightKind: string;
    }[];
    readonly bundles: Record<
      "directional" | "spot" | "point",
      {
        readonly descriptor: {
          readonly descriptors: readonly {
            readonly lightKind: string;
            readonly faceCount: number;
            readonly viewDimension: string;
          }[];
        };
        readonly depthTextureResources: {
          readonly status: string;
          readonly resources: readonly {
            readonly faceCount: number;
            readonly viewDimension: string;
            readonly descriptor: {
              readonly size: readonly [number, number, number];
            } | null;
          }[];
        };
        readonly passPlan: {
          readonly status: string;
          readonly passCount: number;
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
      }
    >;
    readonly rendering: {
      readonly supported: boolean;
      readonly mode: string;
      readonly pipelineKey: string | null;
    };
  };
  readonly draw?: {
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

test("Playwright renders a combined directional, spot, and point shadow scene", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/multi-light-shadow.html?disable-shadow-receiver=1",
  );
  let status = await waitForExampleStatus<MultiLightShadowStatus>(page);

  expect(
    status,
    "multi-light shadow baseline status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  await waitForMultiLightShadowFrame(page, 4);
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/multi-light-shadow.html");
  status = await waitForExampleStatus<MultiLightShadowStatus>(page);

  expect(status, "multi-light shadow status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  status = await waitForMultiLightShadowFrame(page, 4, true);
  await attachExampleStatus("multi-light-shadow-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "multi-light-shadow",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 4,
      lights: 4,
      shadowRequests: 3,
      diagnostics: 0,
    },
    shadow: {
      requests: [
        { lightKind: "directional" },
        { lightKind: "spot" },
        { lightKind: "point" },
      ],
      bundles: {
        directional: {
          descriptor: {
            descriptors: [
              {
                lightKind: "directional",
                faceCount: 1,
                viewDimension: "2d",
              },
            ],
          },
          depthTextureResources: {
            status: "available",
            resources: [
              {
                faceCount: 1,
                viewDimension: "2d",
                descriptor: { size: [512, 512, 1] },
              },
            ],
          },
          passPlan: { status: "ready", passCount: 1 },
          matrixComputation: { status: "ready", matrixCount: 1 },
          matrixBufferResource: { status: "available", matrixCount: 1 },
          commandEncoding: { status: "ready" },
          encoderAssembly: {
            status: "ready",
            counts: { assembledPasses: 1, drawCalls: 1 },
          },
          commandBufferSubmission: { status: "submitted" },
        },
        spot: {
          descriptor: {
            descriptors: [
              {
                lightKind: "spot",
                faceCount: 1,
                viewDimension: "2d",
              },
            ],
          },
          passPlan: { status: "ready", passCount: 1 },
          matrixComputation: { status: "ready", matrixCount: 1 },
          matrixBufferResource: { status: "available", matrixCount: 1 },
          commandBufferSubmission: { status: "submitted" },
        },
        point: {
          descriptor: {
            descriptors: [
              {
                lightKind: "point",
                faceCount: 6,
                viewDimension: "cube",
              },
            ],
          },
          passPlan: { status: "ready", passCount: 6 },
          matrixComputation: { status: "ready", matrixCount: 6 },
          matrixBufferResource: { status: "available", matrixCount: 6 },
          commandBufferSubmission: { status: "submitted" },
        },
      },
      rendering: {
        supported: true,
        mode: "directional-spot-point-depth-compare",
      },
    },
  });
  expect(status.shadow?.rendering.pipelineKey).toContain("shadowMap");
  expect(status.shadow?.rendering.pipelineKey).toContain("pointShadowMap");

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("multi-light-shadow-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleMultiLightShadowScene(screenshot, status);
  expectNamedReceiverSamplesChange(noShadowScreenshot, screenshot, status);
  webGpuValidation.expectNoWarnings();
});

async function waitForMultiLightShadowFrame(
  page: Parameters<typeof waitForExampleStatus>[0],
  minimumFrame: number,
  requireRendering = false,
): Promise<MultiLightShadowStatus> {
  await page.waitForFunction(
    ({ minimumFrame, requireRendering }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: MultiLightShadowStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: MultiLightShadowStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectVisibleMultiLightShadowScene(
  screenshot: Buffer,
  status: MultiLightShadowStatus,
): void {
  const clear = clearPixel(status);
  const samples = {
    wall: strongestRegionSample(screenshot, clear, 0.22, 0.36, 0.78, 0.78),
    leftCaster: strongestRegionSample(
      screenshot,
      clear,
      0.34,
      0.34,
      0.46,
      0.58,
    ),
    centerCaster: strongestRegionSample(
      screenshot,
      clear,
      0.46,
      0.34,
      0.56,
      0.58,
    ),
    rightCaster: strongestRegionSample(
      screenshot,
      clear,
      0.56,
      0.34,
      0.68,
      0.58,
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

function expectNamedReceiverSamplesChange(
  baseline: Buffer,
  shadowed: Buffer,
  status: MultiLightShadowStatus,
): void {
  const clear = clearPixel(status);
  const samples = [
    { name: "directional upper left", x: 0.35, y: 0.5 },
    { name: "directional lower left", x: 0.36, y: 0.62 },
    { name: "spot upper center", x: 0.5, y: 0.5 },
    { name: "spot lower center", x: 0.5, y: 0.66 },
    { name: "point upper right", x: 0.64, y: 0.5 },
    { name: "point lower right", x: 0.68, y: 0.62 },
  ] as const;

  for (const sample of samples) {
    const before = readPngPixel(baseline, sample.x, sample.y);
    const after = readPngPixel(shadowed, sample.x, sample.y);
    const delta = Math.abs(luminance(before) - luminance(after));
    const label = `${sample.name} (${sample.x}, ${sample.y}) before=${JSON.stringify(
      before,
    )} after=${JSON.stringify(after)} delta=${delta}`;

    expect(pixelDistance(before, clear), label).toBeGreaterThan(20);
    expect(pixelDistance(after, clear), label).toBeGreaterThan(20);
    expect(delta, label).toBeGreaterThan(5);
  }
}

function clearPixel(status: MultiLightShadowStatus) {
  return status.clearColor === undefined
    ? { r: 4, g: 5, b: 7, a: 255 }
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

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
