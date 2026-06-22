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

interface SkyboxStatus extends ExampleStatusBase {
  readonly skybox?: {
    readonly textureKey: string;
    readonly samplerKey: string;
  };
  readonly frame?: {
    readonly snapshot?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly skyboxes: number;
      readonly diagnostics: number;
    };
    readonly counts?: {
      readonly meshDraws: number;
      readonly skyboxes: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly readback?: {
      readonly ok: boolean;
      readonly reason?: string;
      readonly message?: string;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    };
  };
}

test("browser renders an ECS-authored cube-map skybox behind scene geometry", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/skybox.html");

  const status = await waitForExampleStatus<SkyboxStatus>(page);

  await attachExampleStatus("skybox-status", status);
  expect(status, "skybox status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "skybox",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    skybox: {
      textureKey: "texture:skybox-demo-cube",
      samplerKey: "sampler:skybox-demo-linear",
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 1,
        skyboxes: 1,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 1,
        skyboxes: 1,
        drawCalls: 2,
        diagnostics: 0,
      },
    },
  });

  const frame = status.frame;

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  if (frame === undefined) {
    return;
  }

  if (frame?.readback?.ok !== true) {
    test.skip(
      true,
      `Skybox pixel assertion requires readback: ${
        frame?.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertSkyboxSamples(frame);
  webGpuValidation.expectNoWarnings();
});

function assertSkyboxSamples(frame: NonNullable<SkyboxStatus["frame"]>): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.016, b: 0.024, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const upperLeft = requiredSample(samples, "sky-upper-left");
  const upperRight = requiredSample(samples, "sky-upper-right");
  const lowerLeft = requiredSample(samples, "sky-lower-left");
  const cubeCenter = requiredSample(samples, "cube-center");

  for (const sample of [upperLeft, upperRight, lowerLeft]) {
    expect(pixelDistance(sample.pixel, clear)).toBeGreaterThan(45);
    expect(sample.pixel.b).toBeGreaterThan(120);
    expect(sample.pixel.g).toBeGreaterThan(70);
  }

  expect(cubeCenter.pixel.r).toBeGreaterThan(cubeCenter.pixel.g + 80);
  expect(cubeCenter.pixel.r).toBeGreaterThan(cubeCenter.pixel.b + 80);
  expect(pixelDistance(cubeCenter.pixel, upperLeft.pixel)).toBeGreaterThan(80);
}

function requiredSample(
  samples: NonNullable<
    NonNullable<SkyboxStatus["frame"]>["readback"]
  >["samples"],
  id: string,
): NonNullable<
  NonNullable<NonNullable<SkyboxStatus["frame"]>["readback"]>["samples"]
>[number] {
  const sample = samples?.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<NonNullable<SkyboxStatus["frame"]>["readback"]>["samples"]
  >[number];
}
