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
    readonly environments?: number;
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
  readonly environment?: {
    readonly authored: number;
    readonly extracted: number;
    readonly handleKey: string;
    readonly resourceKey?: string;
    readonly samplerKey?: string;
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
  };
  readonly resources?: {
    readonly materials: number;
    readonly bindGroups: number;
    readonly lightBindGroup: number;
    readonly diffuseIblTexture?: number;
    readonly reuse?: {
      readonly pipelineHits: number;
      readonly pipelineMisses: number;
      readonly meshBuffersCreated: number;
      readonly meshBuffersReused: number;
      readonly materialBuffersCreated: number;
      readonly materialBuffersReused: number;
      readonly bindGroupsCreated: number;
      readonly bindGroupsReused: number;
      readonly lightBuffersCreated: number;
      readonly lightBuffersReused: number;
      readonly dynamicBufferWrites: number;
    };
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
    materialModel: "standard-direct-lit-diffuse-ibl",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      environments: 1,
      diagnostics: 0,
    },
    material: {
      kind: "standard",
      key: "material:spinning-cube-standard",
      metallicFactor: 0.08,
      roughnessFactor: 0.48,
    },
    lighting: {
      authored: 3,
      extracted: 2,
      kinds: ["ambient", "directional"],
      gpuLights: 2,
    },
    environment: {
      authored: 1,
      extracted: 1,
      handleKey: "environment-map:spinning-cube-studio",
      resourceKey: "texture:spinning-cube-studio:diffuse:texture",
      samplerKey: "texture:spinning-cube-studio:diffuse:sampler",
    },
    pipeline: { key: "standard|iblDiffuse|opaque|back|less|none" },
    resources: {
      materials: 1,
      bindGroups: 4,
      lightBindGroup: 1,
      diffuseIblTexture: 1,
    },
    renderWorld: { active: 1 },
    draw: { packages: 1, drawCalls: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
  });
  expect(initialStatus.resources?.reuse).toBeDefined();

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
  expectDirectionDependentDiffuseIblPixels(
    firstScreenshot,
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
  expect(
    laterStatus.resources?.reuse?.pipelineHits ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(1);
  expect(
    laterStatus.resources?.reuse?.lightBuffersReused ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(1);
  expectNonBlankCubePixel(laterScreenshot, laterStatus);
  expectDirectionDependentDiffuseIblPixels(laterScreenshot, laterStatus);
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

function expectDirectionDependentDiffuseIblPixels(
  screenshot: Buffer,
  status: SpinningCubeStatus,
): void {
  const clear =
    status.clearColor !== undefined &&
    typeof status.clearColor === "object" &&
    status.clearColor !== null
      ? rgbaColorToPixel(
          status.clearColor as { r: number; g: number; b: number; a: number },
        )
      : { r: 4, g: 6, b: 9, a: 255 };
  const samples = {
    frontFace: readPngPixel(screenshot, 0.54, 0.5),
    sideFace: findDistinctFaceSample(
      screenshot,
      clear,
      readPngPixel(screenshot, 0.54, 0.5),
      {
        label: "sideFace",
        xMin: 0.36,
        xMax: 0.44,
        yMin: 0.38,
        yMax: 0.62,
      },
    ),
    lowerFace: findDistinctFaceSample(
      screenshot,
      clear,
      readPngPixel(screenshot, 0.54, 0.5),
      {
        label: "lowerFace",
        xMin: 0.44,
        xMax: 0.62,
        yMin: 0.68,
        yMax: 0.86,
      },
    ),
  };

  for (const [name, pixel] of Object.entries(samples)) {
    expect(
      pixelDistance(pixel, clear),
      `${name} should hit the IBL-lit cube, not clear color; pixel=${JSON.stringify(pixel)} clear=${JSON.stringify(clear)}`,
    ).toBeGreaterThan(24);
  }

  expect(
    pixelDistance(samples.sideFace, samples.frontFace),
    `side and front face samples should differ under face-colored diffuse IBL; samples=${JSON.stringify(samples)}`,
  ).toBeGreaterThan(10);
  expect(
    pixelDistance(samples.frontFace, samples.lowerFace),
    `front and lower face samples should differ under face-colored diffuse IBL; samples=${JSON.stringify(samples)}`,
  ).toBeGreaterThan(10);
}

function findDistinctFaceSample(
  screenshot: Buffer,
  clear: ReturnType<typeof rgbaColorToPixel>,
  reference: ReturnType<typeof readPngPixel>,
  search: {
    readonly label: string;
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
  },
): ReturnType<typeof readPngPixel> {
  let strongest: ReturnType<typeof readPngPixel> | null = null;
  let strongestDistance = 0;

  for (let yStep = 0; yStep <= 8; yStep += 1) {
    const y = search.yMin + ((search.yMax - search.yMin) * yStep) / 8;

    for (let xStep = 0; xStep <= 8; xStep += 1) {
      const x = search.xMin + ((search.xMax - search.xMin) * xStep) / 8;
      const pixel = readPngPixel(screenshot, x, y);

      if (pixelDistance(pixel, clear) <= 24) {
        continue;
      }

      const distance = pixelDistance(pixel, reference);

      if (distance > strongestDistance) {
        strongest = pixel;
        strongestDistance = distance;
      }
    }
  }

  expect(
    strongest,
    `${search.label} should find an in-cube pixel with a different diffuse IBL face color; strongestDistance=${strongestDistance}`,
  ).not.toBeNull();
  expect(
    strongestDistance,
    `${search.label} should differ from the front face under face-colored diffuse IBL; pixel=${JSON.stringify(strongest)} reference=${JSON.stringify(reference)}`,
  ).toBeGreaterThan(10);

  return strongest ?? reference;
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
