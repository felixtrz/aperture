import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type PhysicsCharacterGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

interface PhysicsCharacterStatus extends ExampleStatusBase {
  readonly physics?: {
    readonly backend: string;
    readonly backendVersion: string;
    readonly backendBuild: string;
    readonly execution: string;
    readonly fixedDelta: number;
    readonly fixedStepsRun: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly queryCount: number;
    readonly transformWrites: number;
    readonly velocityWrites: number;
    readonly bodyStateWrites: number;
    readonly debug?: {
      readonly lineCount: number;
      readonly colliderLineCount: number;
      readonly rendered: boolean;
      readonly meshKey: string;
      readonly materialKeys: Record<string, string>;
    };
    readonly scene?: {
      readonly characterCenter: readonly [number, number, number];
      readonly maxX: number;
      readonly maxZ: number;
      readonly groundedSteps: number;
    };
    readonly behavior?: {
      readonly walk: { readonly grounded: boolean; readonly passed: boolean };
      readonly slide: {
        readonly movement: readonly [number, number, number];
        readonly collisionCount: number;
        readonly passed: boolean;
      };
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

type PhysicsCharacterReadbackSample = NonNullable<
  NonNullable<
    NonNullable<PhysicsCharacterStatus["frame"]>["readback"]
  >["samples"]
>[number];

test("browser renders Rapier character-controller movement from a simulation worker", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/physics-character.html", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const status = await waitForPhysicsCharacterStatus(page);

  await attachExampleStatus("physics-character-status", status);
  expect(status, "physics character status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "physics-character",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics: {
      backend: "rapier",
      backendVersion: "0.19.3",
      backendBuild: "performance",
      execution: "simulation-worker",
      behavior: {
        walk: { grounded: true, passed: true },
        slide: { passed: true },
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

  expect(status.frame?.snapshot?.meshDraws).toBeGreaterThanOrEqual(6);
  expect(status.frame?.counts?.meshDraws).toBe(
    status.frame?.snapshot?.meshDraws,
  );
  expect(status.physics?.fixedStepsRun).toBeGreaterThanOrEqual(1);
  expect(status.physics?.bodyCount).toBeGreaterThanOrEqual(5);
  expect(status.physics?.colliderCount).toBeGreaterThanOrEqual(5);
  expect(status.physics?.queryCount).toBeGreaterThan(0);
  expect(status.physics?.transformWrites).toBeGreaterThanOrEqual(5);
  expect(status.physics?.velocityWrites).toBeGreaterThanOrEqual(1);
  expect(status.physics?.bodyStateWrites).toBeGreaterThanOrEqual(5);
  expect(status.physics?.debug).toMatchObject({
    rendered: true,
    meshKey: "mesh:physics-character-debug-lines",
    materialKeys: {
      collider: "material:physics-character-debug-collider",
    },
  });
  expect(status.physics?.debug?.lineCount).toBeGreaterThan(0);
  expect(status.physics?.scene?.groundedSteps).toBeGreaterThan(0);
  expect(status.physics?.scene?.maxX).toBeGreaterThan(0.3);
  expect(status.physics?.scene?.maxZ).toBeGreaterThan(0.2);
  expect(status.physics?.behavior?.slide?.collisionCount).toBeGreaterThan(0);
  expect(status.physics?.behavior?.slide?.movement[2]).toBeGreaterThan(0);

  if (status.frame?.readback?.ok !== true) {
    test.skip(
      true,
      `Physics character pixel assertion requires readback: ${
        status.frame?.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertCharacterRoutePixels(status);
  webGpuValidation.expectNoWarnings();
  await page.close();
});

async function waitForPhysicsCharacterStatus(
  page: Page,
): Promise<PhysicsCharacterStatus | undefined> {
  await page.waitForFunction(
    () =>
      (globalThis as PhysicsCharacterGlobal).__APERTURE_EXAMPLE_STATUS__ !==
      undefined,
    { timeout: 30000 },
  );

  return page.evaluate(
    () =>
      (globalThis as PhysicsCharacterGlobal)
        .__APERTURE_EXAMPLE_STATUS__ as PhysicsCharacterStatus,
  );
}

function assertCharacterRoutePixels(status: PhysicsCharacterStatus): void {
  const clear = rgbaColorToPixel({
    r: 0.014,
    g: 0.018,
    b: 0.025,
    a: 1,
  });
  const samples = status.frame?.readback?.samples ?? [];
  if (samples.every((sample) => isTransparentBlack(sample.pixel))) {
    test.skip(true, "Current-texture readback returned transparent samples.");
  }

  const background = requiredSample(samples, "background");
  const floor = requiredSample(samples, "floor");
  const character = requiredSample(samples, "character");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);

  for (const sample of [floor, character]) {
    expect(
      pixelDistance(sample.pixel, clear),
      `${sample.id} should hit rendered character-route geometry`,
    ).toBeGreaterThan(35);
  }
}

function requiredSample(
  samples: readonly PhysicsCharacterReadbackSample[],
  id: string,
): PhysicsCharacterReadbackSample {
  const sample = samples.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as PhysicsCharacterReadbackSample;
}

function isTransparentBlack(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}): boolean {
  return pixel.r === 0 && pixel.g === 0 && pixel.b === 0 && pixel.a === 0;
}
