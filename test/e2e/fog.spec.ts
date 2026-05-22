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

type FogMode = "linear" | "exp" | "exp2";

interface FogStatus extends ExampleStatusBase {
  readonly mode?: FogMode;
  readonly fog?: {
    readonly color: readonly [number, number, number, number];
    readonly meshKey: string;
    readonly materialKey: string;
  };
  readonly frame?: {
    readonly snapshot?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly fogs: number;
      readonly diagnostics: number;
    };
    readonly counts?: {
      readonly meshDraws: number;
      readonly fogs: number;
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

for (const mode of ["linear", "exp", "exp2"] as const) {
  test(`browser renders ECS-authored ${mode} fog in a square canvas`, async ({
    page,
  }) => {
    const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

    await page.goto(`/examples/fog.html?mode=${mode}`);

    const status = await waitForExampleStatus<FogStatus>(page);

    await attachExampleStatus(`fog-${mode}-status`, status);
    expect(status, "fog status should publish").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);
    expectStatusJsonSafeForGpu(status);
    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "fog",
      mode,
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu-explicit",
      canvas: {
        width: 960,
        height: 960,
      },
      fog: {
        meshKey: "mesh:fog-demo-cube-mesh",
        materialKey: "material:fog-demo-standard-material",
      },
      frame: {
        snapshot: {
          views: 1,
          meshDraws: 2,
          fogs: 1,
          diagnostics: 0,
        },
        counts: {
          meshDraws: 2,
          fogs: 1,
          drawCalls: 1,
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
        `Fog pixel assertion requires readback: ${
          frame?.readback?.reason ?? "unknown"
        }`,
      );
    }

    assertFogSamples(frame);
    webGpuValidation.expectNoWarnings();
  });
}

function assertFogSamples(frame: NonNullable<FogStatus["frame"]>): void {
  const samples = frame.readback?.samples ?? [];
  const nearCube = requiredSample(samples, "near-cube");
  const farCube = requiredSample(samples, "far-cube");
  const background = requiredSample(samples, "background");
  const expectedFog = rgbaColorToPixel({ r: 0.46, g: 0.62, b: 0.82, a: 1 });

  expect(pixelDistance(farCube.pixel, expectedFog)).toBeLessThan(
    pixelDistance(nearCube.pixel, expectedFog),
  );
  expect(farCube.pixel.b).toBeGreaterThan(nearCube.pixel.b + 12);
  expect(nearCube.pixel.r).toBeGreaterThan(farCube.pixel.r + 12);
  expect(pixelDistance(background.pixel, nearCube.pixel)).toBeGreaterThan(35);
}

function requiredSample(
  samples: NonNullable<NonNullable<FogStatus["frame"]>["readback"]>["samples"],
  id: string,
): NonNullable<
  NonNullable<NonNullable<FogStatus["frame"]>["readback"]>["samples"]
>[number] {
  const sample = samples?.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<NonNullable<FogStatus["frame"]>["readback"]>["samples"]
  >[number];
}
