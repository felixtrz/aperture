import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel, type RgbaPixel } from "./png.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface SpinningCubeStatus extends ExampleStatusBase {
  readonly clearColor?: unknown;
  readonly depth?: {
    readonly format: string;
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly transforms: number;
    readonly diagnostics: number;
  };
  readonly resources?: {
    readonly materials: number;
    readonly textures: number;
    readonly samplers: number;
    readonly bindGroups: number;
  };
  readonly binding?: {
    readonly planned: number;
    readonly applied: number;
    readonly diagnostics: number;
  };
  readonly renderWorld?: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command?: {
    readonly commands: number;
    readonly drawCount: number;
    readonly indexedDrawCount: number;
  };
  readonly submission?: {
    readonly commandBuffers: number;
    readonly commands: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly animation?: {
    readonly frames: number;
    readonly elapsedSeconds: number;
    readonly rotationRadians: number;
    readonly radiansPerSecond: number;
    readonly spinAxis: readonly number[];
    readonly transformDiagnostics: number;
  };
}

const samplePoints = [0.38, 0.44, 0.5, 0.56, 0.62].flatMap((y, row) =>
  [0.4, 0.45, 0.5, 0.55, 0.6].map((x, column) => ({
    id: `sample-${row}-${column}`,
    x,
    y,
  })),
);

test("Playwright shows an ECS-driven spinning unlit cube", async ({ page }) => {
  await page.goto("/examples/spinning-cube.html");

  const initialStatus = await waitForExampleStatus<SpinningCubeStatus>(page);

  await attachExampleStatus("spinning-cube-initial-status", initialStatus);
  expect(initialStatus, "spinning cube status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "ecs-spinning-cube",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    depth: { format: "depth24plus" },
    extraction: { views: 1, meshDraws: 1, transforms: 1, diagnostics: 0 },
    resources: { materials: 1, textures: 1, samplers: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
  });

  const firstAnimatedStatus = await waitForAnimationFrame(page, 3);
  const firstFrame = firstAnimatedStatus.animation?.frames ?? 0;
  const firstRotation = firstAnimatedStatus.animation?.rotationRadians ?? 0;
  const firstScreenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("spinning-cube-frame-a.png", {
    body: firstScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus(
    "spinning-cube-frame-a-status",
    firstAnimatedStatus,
  );

  const laterStatus = await waitForAnimationRotation(
    page,
    firstFrame + 12,
    firstRotation + 0.45,
  );
  const laterRotation = laterStatus.animation?.rotationRadians ?? 0;
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("spinning-cube-frame-b.png", {
    body: laterScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("spinning-cube-frame-b-status", laterStatus);

  expect(laterRotation, JSON.stringify(laterStatus, null, 2)).toBeGreaterThan(
    firstRotation + 0.4,
  );

  const diff = compareScreenshotSamples(firstScreenshot, laterScreenshot);

  await attachExampleStatus("spinning-cube-frame-diff", diff);
  expect(diff.changedSamples, JSON.stringify(diff, null, 2)).toBeGreaterThan(2);
  expect(diff.totalDistance, JSON.stringify(diff, null, 2)).toBeGreaterThan(
    120,
  );
});

async function waitForAnimationFrame(
  page: Page,
  targetFrame: number,
): Promise<SpinningCubeStatus> {
  await page.waitForFunction((frame) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: SpinningCubeStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return status?.ok === true && (status.animation?.frames ?? 0) >= frame;
  }, targetFrame);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: SpinningCubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as SpinningCubeStatus,
  );
}

async function waitForAnimationRotation(
  page: Page,
  minimumFrame: number,
  minimumRotation: number,
): Promise<SpinningCubeStatus> {
  await page.waitForFunction(
    ({ frame, rotation }) => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: SpinningCubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        (status.animation?.frames ?? 0) >= frame &&
        (status.animation?.rotationRadians ?? 0) >= rotation
      );
    },
    { frame: minimumFrame, rotation: minimumRotation },
  );

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: SpinningCubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as SpinningCubeStatus,
  );
}

function compareScreenshotSamples(
  before: Buffer,
  after: Buffer,
): {
  readonly changedSamples: number;
  readonly totalDistance: number;
  readonly samples: readonly {
    readonly id: string;
    readonly before: RgbaPixel;
    readonly after: RgbaPixel;
    readonly distance: number;
  }[];
} {
  const samples = samplePoints.map((sample) => {
    const beforePixel = readPngPixel(before, sample.x, sample.y);
    const afterPixel = readPngPixel(after, sample.x, sample.y);
    const distance = pixelDistance(beforePixel, afterPixel);

    return {
      id: sample.id,
      before: beforePixel,
      after: afterPixel,
      distance,
    };
  });

  return {
    changedSamples: samples.filter((sample) => sample.distance > 24).length,
    totalDistance: samples.reduce(
      (total, sample) => total + sample.distance,
      0,
    ),
    samples,
  };
}
