import { expect, test } from "@playwright/test";

import { pixelDistance, readPngImage, readPngImagePixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface CompressedGltfStatus extends ExampleStatusBase {
  readonly route: "draco" | "ktx2";
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly source: {
    readonly routeRegisteredDecoder: boolean;
  };
  readonly assets: {
    readonly selected: { readonly ready?: boolean } | null;
    readonly draco: { readonly ready?: boolean } | null;
    readonly ktx2: { readonly ready?: boolean } | null;
  };
  readonly ktx2: {
    readonly hasCompressionSupport: boolean;
    readonly compressedGpuTarget: boolean;
    readonly rgba32FallbackTarget: boolean;
    readonly targets: readonly {
      readonly gpuFormat: string;
      readonly family: "compressed-gpu" | "rgba32-fallback";
      readonly transcodeTarget: string;
      readonly mipLevelCount?: number;
      readonly sourceData?: {
        readonly mipLevelCount?: number;
      };
    }[];
  };
}

test("Playwright renders the generated compressed glTF Draco route with engine-supplied decoders", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/compressed-gltf.html");
  const initialStatus = await waitForExampleStatus<CompressedGltfStatus>(page);

  expect(initialStatus, "compressed glTF status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const status = await waitForCompressedGltfRoute(page, "draco");
  await attachExampleStatus("compressed-gltf-draco-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "compressed-gltf",
    route: "draco",
    ok: true,
    source: {
      routeRegisteredDecoder: false,
    },
    assets: {
      selected: { ready: true },
      draco: { ready: true },
    },
  });
  expect(status.meshDraws).toBeGreaterThan(0);
  expect(status.drawCalls).toBeGreaterThan(0);
  await expectVisibleCompressedGltfFrame(page, "compressed-gltf-draco.png");
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports the KTX2 transcode target from the generated app loader", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/compressed-gltf.html?asset=ktx2");
  const initialStatus = await waitForExampleStatus<CompressedGltfStatus>(page);

  expect(initialStatus, "compressed KTX2 status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const status = await waitForCompressedGltfRoute(page, "ktx2");
  await attachExampleStatus("compressed-gltf-ktx2-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "compressed-gltf",
    route: "ktx2",
    ok: true,
    source: {
      routeRegisteredDecoder: false,
    },
    assets: {
      selected: { ready: true },
      ktx2: { ready: true },
    },
  });
  expect(status.ktx2.targets.length).toBeGreaterThan(0);
  expect(status.ktx2.targets[0]?.mipLevelCount).toBeGreaterThan(1);
  expect(status.ktx2.targets[0]?.sourceData?.mipLevelCount).toBeGreaterThan(1);
  if (status.ktx2.hasCompressionSupport) {
    expect(status.ktx2.compressedGpuTarget).toBe(true);
  } else {
    expect(status.ktx2.rgba32FallbackTarget).toBe(true);
  }
  expect(status.meshDraws).toBeGreaterThan(0);
  await expectVisibleCompressedGltfFrame(page, "compressed-gltf-ktx2.png");
  webGpuValidation.expectNoWarnings();
});

async function waitForCompressedGltfRoute(
  page: Parameters<typeof waitForExampleStatus>[0],
  route: CompressedGltfStatus["route"],
): Promise<CompressedGltfStatus> {
  await page.waitForFunction(
    (expectedRoute) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: CompressedGltfStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.route === expectedRoute &&
        status.ok === true &&
        status.meshDraws > 0 &&
        status.drawCalls > 0
      );
    },
    route,
    { timeout: 15000 },
  );

  return page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: CompressedGltfStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

async function expectVisibleCompressedGltfFrame(
  page: Parameters<typeof waitForExampleStatus>[0],
  attachmentName: string,
): Promise<void> {
  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach(attachmentName, {
    body: screenshot,
    contentType: "image/png",
  });

  const image = readPngImage(screenshot);
  const clear = { r: 4, g: 5, b: 8, a: 255 };
  let strongestDistance = 0;

  for (let y = 0.2; y <= 0.8; y += 0.1) {
    for (let x = 0.15; x <= 0.85; x += 0.1) {
      strongestDistance = Math.max(
        strongestDistance,
        pixelDistance(readPngImagePixel(image, x, y), clear),
      );
    }
  }

  expect(
    strongestDistance,
    "compressed glTF canvas should contain non-clear pixels",
  ).toBeGreaterThan(18);
}
