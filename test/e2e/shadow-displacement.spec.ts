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

interface ShadowDisplacementStatus extends ExampleStatusBase {
  readonly stripCount: number;
  readonly expectedMeshDraws: number;
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly frameOk: boolean | null;
}

// The ground band: the lower part of the frame showing only the receiver
// plane (and the shadows cast onto it) — the flag and pole project above it.
const GROUND_BAND = { minX: 0.1, maxX: 0.9, minY: 0.62, maxY: 0.92 } as const;

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
}

test("shadow displacement moves the custom caster silhouette with the mesh", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/shadow-displacement.html");
  const initialStatus =
    await waitForExampleStatus<ShadowDisplacementStatus>(page);

  expect(
    initialStatus,
    "shadow displacement status should publish",
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
              readonly __APERTURE_EXAMPLE_STATUS__?: ShadowDisplacementStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: ShadowDisplacementStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("shadow-displacement-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "shadow-displacement",
    ok: true,
    frameOk: true,
    stripCount: 12,
    meshDraws: 14,
  });
  expect(status.drawCalls).toBeGreaterThan(0);

  await waitForPresentedFrames(page, 6);
  const firstCapture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("shadow-displacement-first.png", {
    body: firstCapture,
    contentType: "image/png",
  });

  const firstImage = readPngImage(firstCapture);

  // Control: the flag casts a shadow at all — the ground band must contain a
  // dark (shadowed) region clearly darker than the lit ground around it. The
  // ground is a single flat-lit plane, so without shadows its luminance is
  // nearly uniform and this spread collapses.
  let brightest = 0;
  let darkest = 255;

  for (let y = GROUND_BAND.minY; y <= GROUND_BAND.maxY; y += 0.02) {
    for (let x = GROUND_BAND.minX; x <= GROUND_BAND.maxX; x += 0.02) {
      const pixel = readPngImagePixel(firstImage, x, y);
      const value = luminance(pixel);

      brightest = Math.max(brightest, value);
      darkest = Math.min(darkest, value);
    }
  }

  expect(
    brightest,
    "ground band should contain lit ground pixels",
  ).toBeGreaterThan(80);
  expect(
    brightest - darkest,
    "ground band should contain a shadow region darker than the lit ground",
  ).toBeGreaterThan(45);

  // The shadow silhouette must MOVE: the custom shadowVertex entry applies the
  // same time-driven sine displacement as the main vertex entry, so pixels in
  // the ground band (shadow only — the mesh projects above the band) change
  // between two presented-frame samples.
  let lastCapture: Buffer = firstCapture;

  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page, 12);
        lastCapture = await page.locator("#aperture-canvas").screenshot();
        const nextImage = readPngImage(lastCapture);
        let strongestDistance = 0;

        for (let y = GROUND_BAND.minY; y <= GROUND_BAND.maxY; y += 0.02) {
          for (let x = GROUND_BAND.minX; x <= GROUND_BAND.maxX; x += 0.02) {
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
    .toBeGreaterThan(24);

  await test.info().attach("shadow-displacement-second.png", {
    body: lastCapture,
    contentType: "image/png",
  });

  webGpuValidation.expectNoWarnings();
});
