import { expect, test } from "@playwright/test";

import { readPngImage, readPngImagePixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface LitCustomMaterialStatus extends ExampleStatusBase {
  readonly expectedMeshDraws: number;
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly frameOk: boolean | null;
}

// Screen-space anchors for the two spheres (camera on the x=0 plane at
// [0, 2.3, 5.6] looking at [0, 1, 0], fovY 50, spheres at x = -/+1.15,
// y = 1.05, radius 0.75): centers project near (0.379, 0.491) and
// (0.621, 0.491) with a ~0.079 x / ~0.14 y screen-fraction radius.
const CUSTOM_CENTER = { x: 0.379, y: 0.491 } as const;
const REFERENCE_CENTER = { x: 0.621, y: 0.491 } as const;

// The ground band below the spheres: receives both sphere shadows (the sun
// sits behind the spheres on the x=0 plane, so shadows fall toward the
// camera). The custom sphere's shadow lands in the LEFT half of the band.
const GROUND_BAND = { minX: 0.15, maxX: 0.85, minY: 0.66, maxY: 0.9 } as const;
const CUSTOM_SHADOW_BAND = {
  minX: 0.2,
  maxX: 0.5,
  minY: 0.66,
  maxY: 0.9,
} as const;

// AC3 (A/B parity): mirrored sample offsets on the two spheres' surfaces.
// The custom shader reproduces the StandardMaterial Lambert+GGX response via
// apertureEvaluateLightSurface with the reference sphere's albedo/metallic/
// roughness, so matched pairs OUTSIDE the procedural stripe bands must agree
// per channel; the MEDIAN pair diff excludes the striped minority (~28% of
// the surface) while still asserting exact-BRDF closeness.
const PAIR_OFFSETS: readonly { dx: number; dy: number }[] = [
  0, 0.02, 0.04,
].flatMap((dx) =>
  [-0.1, -0.06, -0.02, 0.02, 0.06, 0.1].map((dy) => ({ dx, dy })),
);

const MEDIAN_PAIR_TOLERANCE = 14;

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

test("lit custom material matches the standard reference sphere under the shared rig", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/lit-custom-material.html");
  const initialStatus =
    await waitForExampleStatus<LitCustomMaterialStatus>(page);

  expect(
    initialStatus,
    "lit custom material status should publish",
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
              readonly __APERTURE_EXAMPLE_STATUS__?: LitCustomMaterialStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: LitCustomMaterialStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("lit-custom-material-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "lit-custom-material",
    ok: true,
    frameOk: true,
    meshDraws: 3,
  });
  expect(status.drawCalls).toBeGreaterThan(0);

  await waitForPresentedFrames(page, 6);
  const capture = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("lit-custom-material.png", {
    body: capture,
    contentType: "image/png",
  });

  const image = readPngImage(capture);

  // 1) The custom sphere is visibly LIT: its sun-facing top is much brighter
  // than its bottom (ambient-only) side. An unlit flat-shaded sphere would
  // collapse this ratio to ~1.
  const brightSide = luminance(
    readPngImagePixel(image, CUSTOM_CENTER.x, CUSTOM_CENTER.y - 0.09),
  );
  const darkSide = luminance(
    readPngImagePixel(image, CUSTOM_CENTER.x, CUSTOM_CENTER.y + 0.11),
  );

  expect(
    brightSide,
    "custom sphere sun-facing side should be lit",
  ).toBeGreaterThan(70);
  expect(
    brightSide / Math.max(darkSide, 1),
    "custom sphere should shade bright-to-dark across the light direction",
  ).toBeGreaterThan(1.6);

  // Both spheres respond to the SAME light direction: the reference sphere's
  // bright side is on the same (top) side.
  const referenceBright = luminance(
    readPngImagePixel(image, REFERENCE_CENTER.x, REFERENCE_CENTER.y - 0.09),
  );
  const referenceDark = luminance(
    readPngImagePixel(image, REFERENCE_CENTER.x, REFERENCE_CENTER.y + 0.11),
  );

  expect(referenceBright / Math.max(referenceDark, 1)).toBeGreaterThan(1.6);

  // 2) The custom sphere casts a shadow: the left half of the ground band
  // (under the custom sphere only) contains a region clearly darker than the
  // lit ground, and the band overall contains lit pixels.
  let groundBrightest = 0;
  let customShadowDarkest = 255;

  for (let y = GROUND_BAND.minY; y <= GROUND_BAND.maxY; y += 0.02) {
    for (let x = GROUND_BAND.minX; x <= GROUND_BAND.maxX; x += 0.02) {
      groundBrightest = Math.max(
        groundBrightest,
        luminance(readPngImagePixel(image, x, y)),
      );
    }
  }

  for (
    let y = CUSTOM_SHADOW_BAND.minY;
    y <= CUSTOM_SHADOW_BAND.maxY;
    y += 0.02
  ) {
    for (
      let x = CUSTOM_SHADOW_BAND.minX;
      x <= CUSTOM_SHADOW_BAND.maxX;
      x += 0.02
    ) {
      customShadowDarkest = Math.min(
        customShadowDarkest,
        luminance(readPngImagePixel(image, x, y)),
      );
    }
  }

  expect(
    groundBrightest,
    "ground band should contain lit ground pixels",
  ).toBeGreaterThan(80);
  expect(
    groundBrightest - customShadowDarkest,
    "custom sphere should cast a shadow darker than the lit ground",
  ).toBeGreaterThan(40);

  // 3) AC3 A/B: matched mirrored pixel pairs on the two spheres' surfaces.
  // The scene is mirror-symmetric about x=0 (camera, sun, point light all on
  // the symmetry plane), so custom(center - dx, y) and reference(center +
  // dx, y) see identical lighting. The custom shader implements the same
  // Lambert+GGX response through the lit-contract helpers with the
  // reference albedo outside its stripe bands, so the MEDIAN per-channel
  // difference across pairs stays within a small tolerance (stripes cover a
  // minority of samples; documented deviations — 3x3 PCF vs PCF-soft — only
  // affect shadow penumbrae, which the sphere surfaces avoid).
  const channelDiffs: number[] = [];
  const pairRecords: {
    dx: number;
    dy: number;
    custom: readonly number[];
    reference: readonly number[];
  }[] = [];

  for (const { dx, dy } of PAIR_OFFSETS) {
    const custom = readPngImagePixel(
      image,
      CUSTOM_CENTER.x - dx,
      CUSTOM_CENTER.y + dy,
    );
    const reference = readPngImagePixel(
      image,
      REFERENCE_CENTER.x + dx,
      REFERENCE_CENTER.y + dy,
    );

    channelDiffs.push(
      Math.max(
        Math.abs(custom.r - reference.r),
        Math.abs(custom.g - reference.g),
        Math.abs(custom.b - reference.b),
      ),
    );
    pairRecords.push({
      dx,
      dy,
      custom: [custom.r, custom.g, custom.b],
      reference: [reference.r, reference.g, reference.b],
    });
  }

  await attachExampleStatus("lit-custom-material-pairs", {
    medianChannelDiff: median(channelDiffs),
    channelDiffs,
    pairs: pairRecords,
  });

  expect(
    median(channelDiffs),
    "median matched-pair per-channel difference should stay within the parity tolerance",
  ).toBeLessThanOrEqual(MEDIAN_PAIR_TOLERANCE);

  webGpuValidation.expectNoWarnings();
});
