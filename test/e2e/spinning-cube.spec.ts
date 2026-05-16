import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface SpinningCubeStatus extends ExampleStatusBase {
  readonly materialModel?: string;
  readonly clearColor?: unknown;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly transforms: number;
    readonly diagnostics: number;
  };
  readonly material?: {
    readonly kind: string;
    readonly key: string;
    readonly baseColorFactor: readonly number[];
    readonly metallicFactor: number;
    readonly roughnessFactor: number;
  };
  readonly lighting?: {
    readonly authored: number;
    readonly extracted: number;
    readonly kinds: readonly string[];
    readonly gpuLights: number;
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
  };
  readonly resources?: {
    readonly materials: number;
    readonly bindGroups: number;
    readonly lightBindGroup: number;
  };
  readonly renderWorld?: {
    readonly active: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly commands: number;
    readonly drawCalls: number;
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

test("Playwright shows an ECS-driven spinning lit standard cube", async ({
  page,
}) => {
  await page.goto("/examples/spinning-cube.html");

  const initialStatus = await waitForExampleStatus<SpinningCubeStatus>(page);

  await attachExampleStatus("spinning-cube-initial-status", initialStatus);
  expect(initialStatus, "spinning cube status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  expectStatusJsonSafeForGpu(initialStatus);

  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "ecs-spinning-cube",
    materialModel: "standard-direct-lit",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    material: {
      kind: "standard",
      key: "material:spinning-cube-standard",
      metallicFactor: 0.08,
      roughnessFactor: 0.48,
    },
    lighting: {
      authored: 2,
      extracted: 2,
      kinds: ["ambient", "directional"],
      gpuLights: 2,
    },
    pipeline: { key: "standard|opaque|back|less|none" },
    resources: { materials: 1, bindGroups: 4, lightBindGroup: 1 },
    renderWorld: { active: 1 },
    draw: { packages: 1, drawCalls: 1 },
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
  expectStatusJsonSafeForGpu(firstAnimatedStatus);
  expectNonBlankCubePixel(firstScreenshot, firstAnimatedStatus);

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
  expectStatusJsonSafeForGpu(laterStatus);

  expect(laterRotation, JSON.stringify(laterStatus, null, 2)).toBeGreaterThan(
    firstRotation + 0.4,
  );
  expect(
    laterStatus.animation?.frames ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBeGreaterThanOrEqual(firstFrame + 12);
  expect(
    laterStatus.command?.indexedDrawCount ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(1);
  expectNonBlankCubePixel(laterScreenshot, laterStatus);
});

function expectNonBlankCubePixel(
  screenshot: Buffer,
  status: SpinningCubeStatus,
): void {
  const center = readPngPixel(screenshot, 0.5, 0.5);
  const clear =
    status.clearColor !== undefined &&
    typeof status.clearColor === "object" &&
    status.clearColor !== null
      ? rgbaColorToPixel(
          status.clearColor as { r: number; g: number; b: number; a: number },
        )
      : { r: 4, g: 6, b: 9, a: 255 };

  expect(
    pixelDistance(center, clear),
    `center pixel should differ from clear color; center=${JSON.stringify(center)} clear=${JSON.stringify(clear)}`,
  ).toBeGreaterThan(36);
}

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
