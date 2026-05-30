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
    }[];
    readonly rendering: { readonly supported: boolean };
  };
}

// M4-T5 pixel proof: a single large floor that is both a shadow caster and a
// receiver, grazed by a directional light. With bias=0/normalBias=0 the floor
// self-shadows (acne speckles → high luminance variance, over-darkened); an
// authored depth+normal bias removes the acne (low variance) and brightens the
// over-occluded surface (the self-shadow detaches — the peter-panning side).
test("M4-T5: authored depth/normal bias removes self-shadow acne on a grazing floor", async ({
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
  expect(authoredBias.status.shadow?.requests[0]?.depthBias).toBeCloseTo(
    0.02,
    4,
  );

  // Acne (bias=0) speckles the floor → high variance; the authored bias cleans
  // it → low, uniform variance.
  expect(
    acne.variance,
    `bias=0 should show self-shadow acne (variance=${acne.variance})`,
  ).toBeGreaterThan(80);
  expect(
    clean.variance,
    `authored bias should produce a clean/uniform floor (variance=${clean.variance})`,
  ).toBeLessThan(25);
  expect(clean.variance).toBeLessThan(acne.variance);

  // The authored bias detaches the over-occluding self-shadow, so the floor
  // brightens (the peter-panning direction: more bias → less self-occlusion).
  expect(
    clean.average,
    `authored bias should brighten the over-occluded floor (acne=${acne.average} clean=${clean.average})`,
  ).toBeGreaterThan(acne.average + 20);

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
