import { expect, test, type Page } from "@playwright/test";

import { readPngPixel } from "./png.js";
import {
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface ShadowBiasStatus extends ExampleStatusBase {
  readonly frame?: number;
  readonly shadow?: {
    readonly requests: readonly {
      readonly depthBias?: number;
      readonly normalBias?: number;
      readonly shadowType?: number;
    }[];
    readonly rendering: { readonly supported: boolean };
  };
}

// M4-T5 proof: a single large floor that is both a shadow caster and receiver,
// grazed by a directional light. The zero-bias route has a small, measurable
// self-shadow variance on the software renderer; an authored depth+normal bias
// reaches the shadow descriptor and removes that variance.
test("M4-T5: authored depth/normal bias reaches the CSM path on a grazing floor", async ({
  page,
}) => {
  const noBias = await captureFloor(page, "shadow-depth-bias=0");
  if (noBias === null) {
    return;
  }
  const authoredBias = await captureFloor(page, "shadow-depth-bias=0.02");
  if (authoredBias === null) {
    return;
  }

  // Foreground floor region (away from the horizon, where the cascade is
  // highest-resolution and the grazing self-shadow acne is cleanest to read).
  const region = { x0: 0.25, y0: 0.6, x1: 0.75, y1: 0.9 } as const;
  const acne = regionLuminanceStats(noBias.shot, region);
  const clean = regionLuminanceStats(authoredBias.shot, region);

  // The override actually reached the renderer.
  expect(noBias.status.shadow?.requests[0]?.depthBias).toBe(0);
  expect(noBias.status.shadow?.requests[0]?.normalBias).toBe(0);
  expect(authoredBias.status.shadow?.requests[0]?.depthBias).toBeCloseTo(
    0.02,
    4,
  );
  expect(authoredBias.status.shadow?.requests[0]?.normalBias).toBeCloseTo(
    0.02,
    4,
  );
  expect(noBias.status.shadow?.rendering.supported).toBe(true);
  expect(authoredBias.status.shadow?.rendering.supported).toBe(true);

  // Bias=0 leaves a small self-shadow variance on the floor; authored bias
  // cleans it into a uniform surface.
  expect(
    acne.variance,
    `bias=0 should show more self-shadow variance than authored bias (bias0=${acne.variance} authored=${clean.variance})`,
  ).toBeGreaterThan(clean.variance + 0.1);
  expect(
    clean.variance,
    `authored bias should produce a clean/uniform floor (variance=${clean.variance})`,
  ).toBeLessThan(0.1);
  expect(clean.variance).toBeLessThan(acne.variance);

  await page.goto("about:blank");
});

// M4-T6 proof: the floor recedes from the camera and so spans all four
// directional cascades. With cascade blending the lit floor is continuous
// across every cascade split — no hard seam step between vertically adjacent
// samples down the receding floor.
test("M4-T6: the cascade-spanning floor is continuous (no seam) across cascade splits", async ({
  page,
}) => {
  const floor = await captureFloor(page, "shadow-depth-bias=0.02");
  if (floor === null) {
    return;
  }

  // Walk a vertical column down the floor (from just below the horizon to the
  // foreground), staying on the floor surface and crossing the cascade splits.
  const luminances: number[] = [];
  for (let yf = 0.56; yf <= 0.96; yf += 0.02) {
    const pixel = readPngPixel(floor.shot, 0.5, yf);
    luminances.push(pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722);
  }

  let maxStep = 0;
  for (let i = 1; i < luminances.length; i += 1) {
    maxStep = Math.max(maxStep, Math.abs(luminances[i]! - luminances[i - 1]!));
  }

  // No cascade seam: adjacent samples along the boundary-spanning floor do not
  // step by more than a small threshold.
  expect(
    maxStep,
    `floor luminance should be continuous across cascade splits (maxStep=${maxStep}, profile=${luminances.map((value) => value.toFixed(0)).join(",")})`,
  ).toBeLessThan(25);

  await page.goto("about:blank");
});

// M4-T7 proof: a pillar resting on the floor casts a shadow. Under PCF
// (shadowType=1) the sampled floor remains nearly uniform; under PCSS
// (shadowType=2) the floor has a broader distance-varying shadow profile.
test("M4-T7: PCSS produces a broader pillar shadow profile than PCF", async ({
  page,
}) => {
  const pcss = await captureFloor(page, "caster=1&shadow-type=2");
  if (pcss === null) {
    return;
  }
  const pcf = await captureFloor(page, "caster=1&shadow-type=1");
  if (pcf === null) {
    return;
  }

  // Near the pillar base (contact) vs far down the shadow toward the camera.
  const nearContact = { x0: 0.4, y0: 0.62, x1: 0.6, y1: 0.68 } as const;
  const farContact = { x0: 0.4, y0: 0.82, x1: 0.6, y1: 0.9 } as const;

  const pcssNear = regionLuminanceStats(pcss.shot, nearContact).average;
  const pcssFar = regionLuminanceStats(pcss.shot, farContact).average;
  const pcfNear = regionLuminanceStats(pcf.shot, nearContact).average;
  const pcfFar = regionLuminanceStats(pcf.shot, farContact).average;
  const pcssFloor = regionLuminanceStats(pcss.shot, {
    x0: 0.25,
    y0: 0.6,
    x1: 0.75,
    y1: 0.9,
  });
  const pcfFloor = regionLuminanceStats(pcf.shot, {
    x0: 0.25,
    y0: 0.6,
    x1: 0.75,
    y1: 0.9,
  });

  expect(pcss.status.shadow?.requests[0]?.shadowType).toBe(2);
  expect(pcf.status.shadow?.requests[0]?.shadowType).toBe(1);

  // PCF: roughly uniform penumbra; near and far shadow darkness are similar.
  expect(
    Math.abs(pcfFar - pcfNear),
    `PCF penumbra should be ~uniform (near=${pcfNear} far=${pcfFar})`,
  ).toBeLessThan(1);

  // PCSS: visibly less uniform than PCF across the floor.
  expect(
    pcssFloor.variance,
    `PCSS should produce a broader shadow profile (pcss=${pcssFloor.variance} pcf=${pcfFloor.variance})`,
  ).toBeGreaterThan(pcfFloor.variance + 0.5);
  expect(Math.abs(pcssFar - pcssNear)).toBeGreaterThan(
    Math.abs(pcfFar - pcfNear) + 0.3,
  );

  await page.goto("about:blank");
});

async function captureFloor(
  page: Page,
  query: string,
): Promise<{
  readonly shot: Buffer;
  readonly status: ShadowBiasStatus;
} | null> {
  await page.goto(`/examples/shadow-bias.html?${query}`);
  let status = await waitForExampleStatus<ShadowBiasStatus>(page);
  expect(
    status,
    `shadow-bias status should publish for ${query}`,
  ).toBeDefined();
  if (status === undefined) {
    return null;
  }
  skipIfUnsupportedWebGpu(status);
  status = await waitForShadowBiasFrame(page);
  const shot = await page.locator("#aperture-canvas").screenshot();
  return { shot, status };
}

async function waitForShadowBiasFrame(page: Page): Promise<ShadowBiasStatus> {
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: ShadowBiasStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      return (
        status !== undefined &&
        (status.frame ?? 0) >= 3 &&
        status.shadow?.rendering.supported === true
      );
    },
    undefined,
    { timeout: 60000 },
  );
  return page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: ShadowBiasStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function regionLuminanceStats(
  shot: Buffer,
  region: { x0: number; y0: number; x1: number; y1: number },
): { average: number; variance: number } {
  const samples: number[] = [];
  for (let yi = 0; yi <= 10; yi += 1) {
    for (let xi = 0; xi <= 10; xi += 1) {
      const x = region.x0 + ((region.x1 - region.x0) * xi) / 10;
      const y = region.y0 + ((region.y1 - region.y0) * yi) / 10;
      const pixel = readPngPixel(shot, x, y);
      samples.push(pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722);
    }
  }
  const average =
    samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance =
    samples.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    samples.length;
  return { average, variance };
}
