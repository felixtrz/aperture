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

interface GpuParticlesStatus extends ExampleStatusBase {
  readonly particles?: {
    readonly effectKey: string;
    readonly expected: {
      readonly particleEmitters: number;
      readonly liveParticles: number;
      readonly dispatches: number;
      readonly drawCalls: number;
    };
  };
  readonly frame?: {
    readonly snapshot?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly particleEmitters: number;
      readonly diagnostics: number;
    };
    readonly counts?: {
      readonly particleEmitters: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly particles?: {
      readonly emitters: number;
      readonly liveParticles: number;
      readonly statesCreated: number;
      readonly statesReused: number;
      readonly staleStatesRemoved: number;
      readonly dispatches: number;
    };
    readonly readback?: {
      readonly ok: boolean;
      readonly reason?: string;
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

test("browser renders worker-authored GPU particle emitter", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/gpu-particles.html");

  const status = await waitForExampleStatus<GpuParticlesStatus>(page);

  await attachExampleStatus("gpu-particles-status", status);
  expect(status, "GPU particles status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "gpu-particles",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    particles: {
      effectKey: "particle-effect:gpu-particles-sparks",
      expected: {
        particleEmitters: 1,
        liveParticles: 384,
        dispatches: 1,
        drawCalls: 1,
      },
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 0,
        particleEmitters: 1,
        diagnostics: 0,
      },
      counts: {
        particleEmitters: 1,
        drawCalls: 1,
        diagnostics: 0,
      },
      particles: {
        emitters: 1,
        liveParticles: 384,
        statesCreated: 1,
        statesReused: 0,
        staleStatesRemoved: 0,
        dispatches: 1,
      },
    },
  });

  const readback = status.frame?.readback;

  if (readback?.ok !== true) {
    test.skip(
      true,
      `GPU particle pixel assertion requires readback: ${readback?.reason ?? "unknown"}`,
    );
  }

  webGpuValidation.expectNoWarnings();
  assertGpuParticlePixels(status);
});

function assertGpuParticlePixels(status: GpuParticlesStatus): void {
  const clear = rgbaColorToPixel({ r: 0.01, g: 0.014, b: 0.026, a: 1 });
  const samples = status.frame?.readback?.samples ?? [];
  const center = requiredSample(samples, "center-emitter");
  const background = requiredSample(samples, "background");
  const upper = samples.find((entry) => entry.id === "upper-spark");
  const right = samples.find((entry) => entry.id === "right-spark");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);
  expect(pixelDistance(center.pixel, clear)).toBeGreaterThan(45);
  expect(
    Math.max(
      upper === undefined ? 0 : pixelDistance(upper.pixel, clear),
      right === undefined ? 0 : pixelDistance(right.pixel, clear),
    ),
  ).toBeGreaterThan(25);
}

function requiredSample(
  samples: NonNullable<
    NonNullable<GpuParticlesStatus["frame"]>["readback"]
  >["samples"],
  id: string,
): NonNullable<
  NonNullable<NonNullable<GpuParticlesStatus["frame"]>["readback"]>["samples"]
>[number] {
  const sample = samples?.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<NonNullable<GpuParticlesStatus["frame"]>["readback"]>["samples"]
  >[number];
}
