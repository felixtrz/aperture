import { expect, test } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface Pixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface HemisphereLightStatus extends ExampleStatusBase {
  readonly counts?: {
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: Pixel;
    }[];
  };
}

test("browser lights a sphere with a hemisphere sky/ground gradient", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/hemisphere-light.html");
  await page.bringToFront();

  const status = await waitForExampleStatus<HemisphereLightStatus>(page);

  await attachExampleStatus("hemisphere-light-status", status);
  expect(status, "hemisphere light status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "hemisphere-light",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    counts: { meshDraws: 1, lights: 1, diagnostics: 0 },
  });

  if (status.readback?.ok !== true) {
    test.skip(true, "Hemisphere pixel assertion requires readback.");
  }

  const skyTop = requiredSample(status, "sky-top");
  const groundBottom = requiredSample(status, "ground-bottom");

  // Both sampled points are lit (not the clear color).
  for (const sample of [skyTop, groundBottom]) {
    expect(sample.pixel.a).toBe(255);
    expect(pixelLuma(sample.pixel)).toBeGreaterThan(12);
  }

  // The upward-facing top reads the blue sky color (blue dominates red); the
  // downward-facing bottom reads the warm ground color (red dominates blue).
  expect(skyTop.pixel.b).toBeGreaterThan(skyTop.pixel.r);
  expect(groundBottom.pixel.r).toBeGreaterThan(groundBottom.pixel.b);
  // The gradient is real: the top is bluer and the bottom is warmer.
  expect(skyTop.pixel.b).toBeGreaterThan(groundBottom.pixel.b + 10);
  expect(groundBottom.pixel.r).toBeGreaterThan(skyTop.pixel.r + 10);

  webGpuValidation.expectNoWarnings();
});

function requiredSample(
  status: HemisphereLightStatus,
  id: string,
): { readonly id: string; readonly pixel: Pixel } {
  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === id,
  );

  expect(sample, JSON.stringify(status, null, 2)).toBeDefined();

  if (sample === undefined) {
    throw new Error(`Missing hemisphere-light sample '${id}'.`);
  }

  return sample;
}

function pixelLuma(pixel: Pixel): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
