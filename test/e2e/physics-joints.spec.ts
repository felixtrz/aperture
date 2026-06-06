import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type PhysicsJointsGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

interface PhysicsJointsStatus extends ExampleStatusBase {
  readonly physics?: {
    readonly backend: string;
    readonly backendVersion: string;
    readonly backendBuild: string;
    readonly execution: string;
    readonly fixedDelta: number;
    readonly fixedStepsRun: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly jointCount: number;
    readonly unsupportedFeatureCount: number;
    readonly unsupportedFeatures: readonly unknown[];
    readonly eventCount: number;
    readonly queryCount: number;
    readonly transformWrites: number;
    readonly velocityWrites: number;
    readonly bodyStateWrites: number;
    readonly timings: {
      readonly syncToBackendMs: number;
      readonly backendStepMs: number;
      readonly writebackMs: number;
    };
    readonly debug?: {
      readonly lineCount: number;
      readonly colliderLineCount: number;
      readonly jointFrameLineCount: number;
      readonly jointAnchorLineCount: number;
      readonly jointAxisLineCount: number;
      readonly rendered: boolean;
      readonly meshKey: string;
      readonly materialKeys: Record<string, string>;
    };
    readonly hinge: {
      readonly anchorError: number;
      readonly center: readonly [number, number, number];
      readonly centerTravel: number;
      readonly maxCenterTravel: number;
      readonly passed: boolean;
    };
    readonly prismatic: {
      readonly center: readonly [number, number, number];
      readonly axisTravel: number;
      readonly yDrift: number;
      readonly zDrift: number;
      readonly maxAxisTravel: number;
      readonly limitExceeded: boolean;
      readonly passed: boolean;
    };
  };
  readonly frame?: {
    readonly snapshot?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly diagnostics: number;
    };
    readonly counts?: {
      readonly meshDraws: number;
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

type PhysicsJointsReadbackSample = NonNullable<
  NonNullable<NonNullable<PhysicsJointsStatus["frame"]>["readback"]>["samples"]
>[number];

test("browser renders Rapier hinge and prismatic joints from a simulation worker", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/physics-joints.html", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const status = await waitForPhysicsJointsStatus(page);

  await attachExampleStatus("physics-joints-status", status);
  expect(status, "physics joints status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "physics-joints",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics: {
      backend: "rapier",
      backendVersion: "0.19.3",
      backendBuild: "performance",
      execution: "simulation-worker",
      jointCount: 2,
      hinge: {
        passed: true,
      },
      prismatic: {
        passed: true,
        limitExceeded: false,
      },
    },
    frame: {
      snapshot: {
        views: 1,
        diagnostics: 0,
      },
      counts: {
        diagnostics: 0,
      },
    },
  });
  expect(status.frame?.snapshot?.meshDraws).toBeGreaterThanOrEqual(8);
  expect(status.frame?.counts?.meshDraws).toBe(
    status.frame?.snapshot?.meshDraws,
  );
  expect(status.frame?.counts?.drawCalls).toBe(
    status.frame?.snapshot?.meshDraws,
  );

  expect(status.physics?.fixedStepsRun).toBeGreaterThanOrEqual(360);
  expect(status.physics?.bodyCount).toBe(4);
  expect(status.physics?.colliderCount).toBe(4);
  expect(status.physics?.unsupportedFeatureCount).toBe(0);
  expect(status.physics?.unsupportedFeatures).toEqual([]);
  expect(status.physics?.transformWrites).toBe(4);
  expect(status.physics?.velocityWrites).toBe(2);
  expect(status.physics?.bodyStateWrites).toBe(4);
  expect(status.physics?.timings?.syncToBackendMs).toBeGreaterThanOrEqual(0);
  expect(status.physics?.timings?.backendStepMs).toBeGreaterThanOrEqual(0);
  expect(status.physics?.timings?.writebackMs).toBeGreaterThanOrEqual(0);
  expect(status.physics?.debug).toMatchObject({
    rendered: true,
    meshKey: "mesh:physics-joints-debug-lines",
    materialKeys: {
      collider: "material:physics-joints-debug-collider",
      jointFrame: "material:physics-joints-debug-joint-frame",
      jointAxis: "material:physics-joints-debug-joint-axis",
    },
  });
  expect(status.physics?.debug?.lineCount).toBeGreaterThan(0);
  expect(status.physics?.debug?.colliderLineCount).toBeGreaterThan(0);
  expect(status.physics?.debug?.jointFrameLineCount).toBeGreaterThanOrEqual(4);
  expect(status.physics?.debug?.jointAnchorLineCount).toBeGreaterThanOrEqual(2);
  expect(status.physics?.debug?.jointAxisLineCount).toBeGreaterThanOrEqual(2);

  expect(status.physics?.hinge?.anchorError).toBeLessThanOrEqual(0.14);
  expect(status.physics?.hinge?.maxCenterTravel).toBeGreaterThanOrEqual(0.1);
  expect(status.physics?.prismatic?.maxAxisTravel).toBeGreaterThanOrEqual(0.32);
  expect(status.physics?.prismatic?.axisTravel).toBeGreaterThan(0.25);
  expect(status.physics?.prismatic?.axisTravel).toBeLessThan(0.7);
  expect(Math.abs(status.physics?.prismatic?.yDrift ?? 1)).toBeLessThanOrEqual(
    0.08,
  );
  expect(Math.abs(status.physics?.prismatic?.zDrift ?? 1)).toBeLessThanOrEqual(
    0.08,
  );

  if (status.frame?.readback?.ok !== true) {
    test.skip(
      true,
      `Physics joints pixel assertion requires readback: ${
        status.frame?.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertJointRoutePixels(status);
  webGpuValidation.expectNoWarnings();
});

async function waitForPhysicsJointsStatus(
  page: Page,
): Promise<PhysicsJointsStatus | undefined> {
  await page.waitForFunction(
    () =>
      (globalThis as PhysicsJointsGlobal).__APERTURE_EXAMPLE_STATUS__ !==
      undefined,
    { timeout: 30000 },
  );

  return page.evaluate(
    () =>
      (globalThis as PhysicsJointsGlobal)
        .__APERTURE_EXAMPLE_STATUS__ as PhysicsJointsStatus,
  );
}

function assertJointRoutePixels(status: PhysicsJointsStatus): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.016, b: 0.026, a: 1 });
  const samples = status.frame?.readback?.samples ?? [];
  if (samples.every((sample) => isTransparentBlack(sample.pixel))) {
    test.skip(true, "Current-texture readback returned transparent samples.");
  }

  const background = requiredSample(samples, "background");
  const ground = requiredSample(samples, "ground");
  const hingeAnchor = requiredSample(samples, "hinge-anchor");
  const prismaticRail = requiredSample(samples, "prismatic-rail");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);

  for (const sample of [ground, hingeAnchor, prismaticRail]) {
    expect(
      pixelDistance(sample.pixel, clear),
      `${sample.id} should hit rendered joint-route geometry`,
    ).toBeGreaterThan(45);
  }
}

function isTransparentBlack(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}): boolean {
  return pixel.r === 0 && pixel.g === 0 && pixel.b === 0 && pixel.a === 0;
}

function requiredSample(
  samples: readonly PhysicsJointsReadbackSample[] | undefined,
  id: string,
): PhysicsJointsReadbackSample {
  const sample = samples?.find((entry) => entry.id === id);

  expect(sample, `expected readback sample '${id}'`).toBeDefined();

  return sample as PhysicsJointsReadbackSample;
}
