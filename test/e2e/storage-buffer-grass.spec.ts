import { expect, test } from "@playwright/test";

import { pixelDistance, readPngImage, readPngImagePixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface StorageBufferGrassStatus extends ExampleStatusBase {
  readonly bladeCount: number;
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly runtimeBuffers: number;
  readonly frameOk: boolean | null;
}

test("storage buffer grass renders one instanced draw fed by runtime buffer packets", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/storage-buffer-grass.html");
  const initialStatus =
    await waitForExampleStatus<StorageBufferGrassStatus>(page);

  expect(
    initialStatus,
    "storage buffer grass status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const status = (
            globalThis as {
              readonly __APERTURE_EXAMPLE_STATUS__?: StorageBufferGrassStatus;
            }
          ).__APERTURE_EXAMPLE_STATUS__;

          return status?.ok === true;
        }),
      { timeout: 30000 },
    )
    .toBe(true);

  const status = await page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: StorageBufferGrassStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("storage-buffer-grass-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "storage-buffer-grass",
    ok: true,
    frameOk: true,
    bladeCount: 64,
    meshDraws: 64,
    runtimeBuffers: 1,
  });
  // 64 blades sharing one mesh + one custom material collapse into instanced
  // draw calls rather than 64 individual draws.
  expect(status.drawCalls).toBeGreaterThan(0);
  expect(status.drawCalls).toBeLessThan(status.bladeCount);

  // Wind: runtime-buffer updates must move pixels between presented frames.
  await waitForPresentedFrames(page, 6);
  const firstCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("storage-buffer-grass-first.png", {
    body: firstCapture,
    contentType: "image/png",
  });

  const firstImage = readPngImage(firstCapture);
  let lastCapture: Buffer = firstCapture;

  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page, 12);
        lastCapture = await page.locator("#aperture-canvas").screenshot();
        const nextImage = readPngImage(lastCapture);
        let strongestDistance = 0;

        for (let y = 0.1; y <= 0.9; y += 0.05) {
          for (let x = 0.1; x <= 0.9; x += 0.05) {
            strongestDistance = Math.max(
              strongestDistance,
              pixelDistance(
                readPngImagePixel(firstImage, x, y),
                readPngImagePixel(nextImage, x, y),
              ),
            );
          }
        }

        return strongestDistance;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(12);

  await test.info().attach("storage-buffer-grass-second.png", {
    body: lastCapture,
    contentType: "image/png",
  });

  // The field itself renders non-clear pixels (grass green over the dark
  // clear color) so a black canvas cannot pass the motion check trivially.
  const clear = { r: 3, g: 5, b: 8, a: 255 };
  let strongestClearDistance = 0;

  for (let y = 0.2; y <= 0.85; y += 0.05) {
    for (let x = 0.1; x <= 0.9; x += 0.05) {
      strongestClearDistance = Math.max(
        strongestClearDistance,
        pixelDistance(readPngImagePixel(firstImage, x, y), clear),
      );
    }
  }

  expect(
    strongestClearDistance,
    "grass canvas should contain non-clear pixels",
  ).toBeGreaterThan(24);

  webGpuValidation.expectNoWarnings();
});
