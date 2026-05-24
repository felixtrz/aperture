import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface AreaLightShapesStatus extends ExampleStatusBase {
  readonly areaLights?: readonly {
    readonly kind: "rect-area";
    readonly shape: "rect" | "disk" | "sphere";
    readonly width: number;
    readonly height: number;
    readonly intensity: number;
  }[];
  readonly counts?: {
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
    readonly drawCalls: number;
    readonly submittedShapes: number;
    readonly submittedScenarios: number;
  };
  readonly resources?: {
    readonly areaLightLtc?: {
      readonly size: number;
      readonly format: string;
      readonly payloadBytes: number;
      readonly boundEntries: readonly string[];
    };
  };
  readonly scenarios?: readonly {
    readonly id: string;
    readonly shape: "rect" | "disk" | "sphere";
    readonly material: string;
    readonly roughness: number;
    readonly surfaceRotationY: number;
  }[];
  readonly readback?: {
    readonly ok: boolean;
    readonly samples?: readonly AreaLightShapeSample[];
  };
}

interface AreaLightShapeSample {
  readonly id: string;
  readonly scenario: string;
  readonly shape: "rect" | "disk" | "sphere";
  readonly pixel: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
}

test("browser distinguishes rect, disk, and sphere area-light shapes", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/area-light-shapes.html");

  const status = await waitForExampleStatus<AreaLightShapesStatus>(page);

  await attachExampleStatus("area-light-shapes-status", status);
  expect(status, "area light shapes status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "area-light-shapes",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    areaLights: [
      { kind: "rect-area", shape: "rect" },
      { kind: "rect-area", shape: "disk" },
      { kind: "rect-area", shape: "sphere" },
    ],
    counts: {
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
      submittedShapes: 3,
      submittedScenarios: 9,
    },
    resources: {
      areaLightLtc: {
        size: 64,
        format: "rgba16float",
        payloadBytes: 32768,
        boundEntries: [
          "standard-area-light-ltc:matrix",
          "standard-area-light-ltc:fresnel",
          "standard-area-light-ltc:sampler",
        ],
      },
    },
  });
  expect(status.scenarios?.map((scenario) => scenario.id)).toEqual([
    "rect-glossy",
    "rect-rough",
    "rect-oblique",
    "disk-glossy",
    "disk-rough",
    "disk-oblique",
    "sphere-glossy",
    "sphere-rough",
    "sphere-oblique",
  ]);

  if (status.readback?.ok !== true) {
    test.skip(true, "Area-light shape pixel assertion requires readback.");
  }

  const rect = requiredSample(status, "rect-rough-center");
  const disk = requiredSample(status, "disk-rough-center");
  const sphere = requiredSample(status, "sphere-rough-center");
  const rectLeft = requiredSample(status, "rect-rough-left");
  const rectUpper = requiredSample(status, "rect-rough-upper");
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.018, b: 0.026, a: 1 });

  for (const sample of [rect, disk, sphere]) {
    expect(sample.pixel.a).toBe(255);
    expect(pixelLuma(sample.pixel)).toBeGreaterThan(20);
  }
  expect(pixelDistance(rect.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(disk.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(sphere.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(rect.pixel, disk.pixel)).toBeGreaterThan(4);
  expect(pixelDistance(disk.pixel, sphere.pixel)).toBeGreaterThan(4);
  expect(pixelLuma(rect.pixel)).toBeGreaterThan(pixelLuma(rectLeft.pixel) + 4);
  expect(pixelLuma(rect.pixel)).toBeGreaterThan(pixelLuma(rectUpper.pixel) + 4);
  for (const shape of ["rect", "disk", "sphere"] as const) {
    const glossy = requiredSample(status, `${shape}-glossy-center`);
    const rough = requiredSample(status, `${shape}-rough-center`);
    const oblique = requiredSample(status, `${shape}-oblique-center`);

    expect(pixelDistance(glossy.pixel, rough.pixel)).toBeGreaterThan(2);
    expect(pixelDistance(rough.pixel, oblique.pixel)).toBeGreaterThan(2);
  }
  webGpuValidation.expectNoWarnings();
});

function requiredSample(
  status: AreaLightShapesStatus,
  id: string,
): AreaLightShapeSample {
  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === id,
  );

  expect(sample, JSON.stringify(status, null, 2)).toBeDefined();

  if (sample === undefined) {
    throw new Error(`Missing area-light shape sample '${id}'.`);
  }

  return sample;
}

function pixelLuma(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
