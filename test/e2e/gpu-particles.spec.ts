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
    readonly curves: {
      readonly sampleCount: number;
      readonly size: {
        readonly first: number;
        readonly middle: number;
        readonly last: number;
      };
      readonly color: {
        readonly first: readonly number[];
        readonly middle: readonly number[];
        readonly last: readonly number[];
      };
    };
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
      curves: {
        sampleCount: 16,
        size: {
          first: expect.any(Number),
          middle: expect.any(Number),
          last: expect.any(Number),
        },
        color: {
          first: expect.any(Array),
          middle: expect.any(Array),
          last: expect.any(Array),
        },
      },
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
  const curves = status.particles?.curves;

  expect(curves).toBeDefined();

  if (curves !== undefined) {
    expect(curves.size.first).toBeCloseTo(0.8);
    expect(curves.size.middle).toBeGreaterThan(curves.size.first);
    expect(curves.size.last).toBeCloseTo(0.2);
    expect(curves.color.first[0]).toBeCloseTo(1);
    expect(curves.color.first[1]).toBeCloseTo(0.34);
    expect(curves.color.first[2]).toBeCloseTo(0.08);
    expect(curves.color.first[3]).toBeCloseTo(0.92);
    expect(curves.color.middle[1]).toBeGreaterThan(curves.color.first[1] ?? 0);
    expect(curves.color.last[0]).toBeCloseTo(0.08);
    expect(curves.color.last[1]).toBeCloseTo(0.18);
    expect(curves.color.last[2]).toBeCloseTo(1);
    expect(curves.color.last[3]).toBe(0);
  }

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
