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

interface VolumeTextureLutStatus extends ExampleStatusBase {
  readonly counts?: {
    readonly meshDraws: number;
    readonly diagnostics: number;
    readonly drawCalls: number;
  };
  readonly customMaterial?: {
    readonly bindingCount: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: Pixel;
    }[];
  };
}

test("browser samples a 3D LUT volume whose depth coordinate selects the slice", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/volume-texture-lut.html");
  await page.bringToFront();

  const status = await waitForExampleStatus<VolumeTextureLutStatus>(page);

  await attachExampleStatus("volume-texture-lut-status", status);
  expect(status, "volume texture LUT status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "volume-texture-lut",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-app-route",
    counts: { meshDraws: 1, diagnostics: 0 },
  });
  // The custom material binds exactly the 3D texture + its sampler.
  expect(status.customMaterial?.bindingCount).toBe(2);

  if (status.readback?.ok !== true) {
    test.skip(true, "Volume LUT pixel assertion requires readback.");
  }

  const top = requiredSample(status, "slice-top");
  const bottom = requiredSample(status, "slice-bottom");

  for (const sample of [top, bottom]) {
    expect(sample.pixel.a).toBe(255);
    expect(pixelLuma(sample.pixel)).toBeGreaterThan(20);
  }

  // Top of the quad samples the first slice (red): red is the dominant channel.
  expect(top.pixel.r).toBeGreaterThan(top.pixel.g);
  expect(top.pixel.r).toBeGreaterThan(top.pixel.b);
  // Bottom samples the last slice (yellow): red and green both beat blue.
  expect(bottom.pixel.r).toBeGreaterThan(bottom.pixel.b);
  expect(bottom.pixel.g).toBeGreaterThan(bottom.pixel.b);
  // Walking the depth coordinate from the red slice to the yellow slice raises
  // green — proof the sampling coordinate selects a different slice.
  expect(bottom.pixel.g).toBeGreaterThan(top.pixel.g + 20);

  webGpuValidation.expectNoWarnings();
});

function requiredSample(
  status: VolumeTextureLutStatus,
  id: string,
): { readonly id: string; readonly pixel: Pixel } {
  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === id,
  );

  expect(sample, JSON.stringify(status, null, 2)).toBeDefined();

  if (sample === undefined) {
    throw new Error(`Missing volume-texture-lut sample '${id}'.`);
  }

  return sample;
}

function pixelLuma(pixel: Pixel): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
