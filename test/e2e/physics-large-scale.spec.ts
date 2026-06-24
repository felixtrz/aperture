import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface PhysicsLargeScaleStatus extends ExampleStatusBase {
  readonly physics?: {
    readonly backend: string;
    readonly backendVersion: string;
    readonly backendBuild: string;
    readonly execution: string;
    readonly fixedDelta: number;
    readonly fixedStepsRun: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly readbackCount: number;
    readonly transformWrites: number;
    readonly velocityWrites: number;
    readonly bodyStateWrites: number;
    readonly assetBackedColliderCount: number;
    readonly unsupportedFeatureCount: number;
    readonly unsupportedFeatures: readonly unknown[];
    readonly assetShapeUnsupportedCount: number;
    readonly eventCount: number;
    readonly queryCount: number;
    readonly activeBodyCount: number;
    readonly sleepingBodyCount: number;
    readonly dynamicBodyCount: number;
    readonly terrainRaycast: unknown;
    readonly timings: {
      readonly syncToBackendMs: number;
      readonly backendStepMs: number;
      readonly writebackMs: number;
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

test("browser renders large-scale Rapier asset-collider physics from a simulation worker", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/physics-large-scale.html");

  const status = await waitForExampleStatus<PhysicsLargeScaleStatus>(page);

  await attachExampleStatus("physics-large-scale-status", status);
  expect(status, "physics large-scale status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "physics-large-scale",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics: {
      backend: "rapier",
      backendVersion: "0.19.3",
      backendBuild: "performance",
      execution: "simulation-worker",
      assetBackedColliderCount: 1,
      unsupportedFeatureCount: 0,
      unsupportedFeatures: [],
      assetShapeUnsupportedCount: 0,
      dynamicBodyCount: 256,
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
  expect(status.physics?.fixedStepsRun).toBeGreaterThanOrEqual(300);
  expect(status.physics?.bodyCount).toBeGreaterThanOrEqual(257);
  expect(status.physics?.colliderCount).toBeGreaterThanOrEqual(257);
  expect(status.physics?.readbackCount).toBeGreaterThanOrEqual(257);
  expect(status.physics?.transformWrites).toBeGreaterThanOrEqual(257);
  expect(status.physics?.velocityWrites).toBeGreaterThanOrEqual(256);
  expect(status.physics?.bodyStateWrites).toBeGreaterThanOrEqual(257);
  expect(status.physics?.eventCount).toBeGreaterThanOrEqual(0);
  expect(status.physics?.queryCount).toBeGreaterThanOrEqual(0);
  expect(
    (status.physics?.activeBodyCount ?? 0) +
      (status.physics?.sleepingBodyCount ?? 0),
  ).toBe(256);
  expect(status.physics?.terrainRaycast).toMatchObject({
    entity: expect.any(String),
    collider: expect.any(String),
  });
  expectFiniteTiming(status.physics?.timings?.syncToBackendMs);
  expectFiniteTiming(status.physics?.timings?.backendStepMs);
  expectFiniteTiming(status.physics?.timings?.writebackMs);
  expect(status.frame?.snapshot?.meshDraws).toBeGreaterThanOrEqual(257);
  expect(status.frame?.counts?.meshDraws).toBe(
    status.frame?.snapshot?.meshDraws,
  );
  expect(status.frame?.counts?.drawCalls ?? 0).toBeGreaterThan(0);
  expect(
    status.frame?.counts?.drawCalls ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(status.frame?.snapshot?.meshDraws ?? 0);
  expect(status.frame?.readback?.ok).toBe(true);
  expect(
    status.frame?.readback?.samples?.some(
      (sample) =>
        pixelDistance(
          sample.pixel,
          rgbaColorToPixel({ r: 0.012, g: 0.016, b: 0.024, a: 1 }),
        ) > 45,
    ),
  ).toBe(true);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  assertLargeScalePixels(screenshot);
  webGpuValidation.expectNoWarnings();
});

function expectFiniteTiming(value: number | undefined): void {
  expect(value).toEqual(expect.any(Number));
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
}

function assertLargeScalePixels(screenshot: Buffer): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.016, b: 0.024, a: 1 });
  const background = readPngPixel(screenshot, 0.5, 0.04);
  const scenePixels = [
    readPngPixel(screenshot, 0.5, 0.91),
    readPngPixel(screenshot, 0.475, 0.85),
    readPngPixel(screenshot, 0.525, 0.85),
    readPngPixel(screenshot, 0.575, 0.85),
  ];

  expect(pixelDistance(background, clear)).toBeLessThan(40);
  expect(
    scenePixels.filter((pixel) => pixelDistance(pixel, clear) > 45).length,
  ).toBeGreaterThanOrEqual(1);
}
