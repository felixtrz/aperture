import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MaterialShowcaseStatus extends ExampleStatusBase {
  readonly materialModels?: readonly string[];
  readonly frame?: number;
  readonly animation?: {
    readonly elapsedSeconds: number;
    readonly spinningCubes: number;
  };
  readonly draw?: {
    readonly cubes: number;
    readonly indexedDrawCalls: number;
    readonly indexCount: number;
  };
  readonly extraction?: {
    readonly environments?: number;
  };
  readonly environment?: {
    readonly authored: number;
    readonly extracted: number;
    readonly activeKey: string;
    readonly activeVersion: string;
    readonly activeReady: boolean;
    readonly workerActiveIndex: number;
    readonly prepared?: {
      readonly activeReady: boolean;
      readonly totals: {
        readonly assetCount: number;
        readonly readyAssetCount: number;
        readonly diffuseTextureResourcesCreated: number;
        readonly diffuseTextureResourcesReused: number;
        readonly specularTextureResourcesCreated: number;
        readonly specularTextureResourcesReused: number;
        readonly samplerResourcesCreated: number;
        readonly samplerResourcesReused: number;
        readonly standardIblBindGroupsCreated: number;
        readonly standardIblBindGroupsReused: number;
      };
      readonly assets: readonly {
        readonly environmentMapResourceKey: string;
        readonly version: string;
        readonly ready: boolean;
        readonly resourceKeys: {
          readonly diffuseResourceKey: string;
          readonly diffuseTextureKey: string;
          readonly specularResourceKey: string;
          readonly specularTextureKey: string;
          readonly samplerKeys: readonly string[];
          readonly bindGroupResourceKey: string | null;
        };
      }[];
    };
  };
  readonly resources?: {
    readonly pipelineKeys?: readonly string[];
    readonly standardTextureFeatures?: readonly string[];
  };
}

test("Playwright shows three spinning material showcase cubes", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/materials-showcase.html");

  const initialStatus =
    await waitForExampleStatus<MaterialShowcaseStatus>(page);

  await attachExampleStatus("materials-showcase-initial-status", initialStatus);
  expect(
    initialStatus,
    "materials showcase status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  expectStatusJsonSafeForGpu(initialStatus);
  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "materials-showcase",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    materialModels: ["unlit", "standard-pbr-diffuse-ibl", "matcap"],
    animation: { spinningCubes: 3 },
    extraction: { environments: 1 },
    environment: {
      authored: 2,
      extracted: 1,
      activeKey: "environment-map:materials-showcase-warm-studio",
      activeVersion: "warm-v1",
      activeReady: true,
      workerActiveIndex: 0,
      prepared: {
        activeReady: true,
        totals: {
          assetCount: 2,
          readyAssetCount: 2,
          diffuseTextureResourcesCreated: 0,
          diffuseTextureResourcesReused: 2,
          specularTextureResourcesCreated: 0,
          specularTextureResourcesReused: 2,
          samplerResourcesCreated: 0,
          samplerResourcesReused: 4,
          standardIblBindGroupsCreated: 0,
          standardIblBindGroupsReused: 2,
        },
      },
    },
    draw: { cubes: 3, indexedDrawCalls: 3, indexCount: 36 },
    resources: {
      pipelineKeys: expect.arrayContaining([
        expect.stringContaining("iblDiffuse"),
        expect.stringContaining("iblSpecularProof"),
      ]),
      standardTextureFeatures: [
        "baseColorTexture",
        "metallicRoughnessTexture",
        "occlusionTexture",
        "emissiveTexture",
        "iblDiffuse",
        "iblSpecularProof",
      ],
    },
  });

  const firstFrame = initialStatus.frame ?? 0;
  const firstScreenshot = await page.locator("#aperture-canvas").screenshot();
  const warmStandardSample = strongestRegionSample(
    firstScreenshot,
    0.43,
    0.4,
    0.56,
    0.68,
  );

  expectVisibleMaterialRegions(firstScreenshot);

  const laterStatus = await waitForShowcaseFrame(page, firstFrame + 12);
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();
  const coolStatus = await waitForShowcaseEnvironment(
    page,
    "environment-map:materials-showcase-cool-studio",
  );
  const coolScreenshot = await page.locator("#aperture-canvas").screenshot();
  const coolStandardSample = strongestRegionSample(
    coolScreenshot,
    0.43,
    0.4,
    0.56,
    0.68,
  );

  await attachExampleStatus("materials-showcase-later-status", laterStatus);
  await attachExampleStatus("materials-showcase-cool-status", coolStatus);
  await test.info().attach("materials-showcase-frame.png", {
    body: laterScreenshot,
    contentType: "image/png",
  });
  expectStatusJsonSafeForGpu(laterStatus);
  webGpuValidation.expectNoWarnings();
  expect(laterStatus.frame ?? 0).toBeGreaterThanOrEqual(firstFrame + 12);
  expect(coolStatus.environment).toMatchObject({
    activeKey: "environment-map:materials-showcase-cool-studio",
    activeVersion: "cool-v1",
    activeReady: true,
    workerActiveIndex: 1,
  });
  expect(
    pixelDistance(warmStandardSample, coolStandardSample),
    `warm and cool prepared IBL assets should visibly alter the StandardMaterial cube; warm=${JSON.stringify(
      warmStandardSample,
    )} cool=${JSON.stringify(coolStandardSample)}`,
  ).toBeGreaterThan(20);
  expectVisibleMaterialRegions(laterScreenshot);
  expectVisibleMaterialRegions(coolScreenshot);
});

function expectVisibleMaterialRegions(screenshot: Buffer): void {
  const clear = { r: 4, g: 5, b: 7, a: 255 };
  const samples = {
    unlit: strongestRegionSample(screenshot, 0.24, 0.4, 0.37, 0.68),
    standard: strongestRegionSample(screenshot, 0.43, 0.4, 0.56, 0.68),
    matcap: strongestRegionSample(screenshot, 0.6, 0.4, 0.74, 0.68),
  };

  for (const [name, sample] of Object.entries(samples)) {
    expect(
      pixelDistance(sample, clear),
      `${name} cube region should contain non-clear pixels; sample=${JSON.stringify(
        sample,
      )}`,
    ).toBeGreaterThan(36);
  }

  expect(pixelDistance(samples.unlit, samples.standard)).toBeGreaterThan(30);
  expect(pixelDistance(samples.standard, samples.matcap)).toBeGreaterThan(24);
}

function strongestRegionSample(
  screenshot: Buffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ReturnType<typeof readPngPixel> {
  const clear = { r: 4, g: 5, b: 7, a: 255 };
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

async function waitForShowcaseFrame(
  page: Page,
  minimumFrame: number,
): Promise<MaterialShowcaseStatus> {
  await page.waitForFunction((frame) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: MaterialShowcaseStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return status?.ok === true && (status.frame ?? 0) >= frame;
  }, minimumFrame);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: MaterialShowcaseStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as MaterialShowcaseStatus,
  );
}

async function waitForShowcaseEnvironment(
  page: Page,
  activeKey: string,
): Promise<MaterialShowcaseStatus> {
  await page.waitForFunction((expectedActiveKey) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: MaterialShowcaseStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return (
      status?.ok === true &&
      status.environment?.activeKey === expectedActiveKey &&
      status.environment.activeReady === true &&
      status.extraction?.environments === 1
    );
  }, activeKey);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: MaterialShowcaseStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__ as MaterialShowcaseStatus,
  );
}
