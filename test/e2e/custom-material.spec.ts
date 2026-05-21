import { expect, test } from "@playwright/test";

import type { SingleDrawExampleStatus } from "./example-status-types.js";
import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";

interface CustomMaterialStatus extends SingleDrawExampleStatus {
  readonly customMaterial?: {
    readonly family: string;
    readonly sourceMaterialKey: string;
    readonly materialResourceKey: string;
    readonly pipelineKey: string;
    readonly bindGroupResourceKey: string;
    readonly uniformColor: readonly [number, number, number, number];
    readonly diagnostics: number;
  };
  readonly animation?: {
    readonly frame: number;
    readonly elapsedSeconds: number;
    readonly deltaSeconds: number;
    readonly shaderTime: number;
    readonly samples: readonly {
      readonly frame: number;
      readonly shaderTime: number;
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
      };
    }[];
  };
}

test("visible WaterMaterial custom shader animates through WebGPU", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const firstStatus = await loadExampleStatus<CustomMaterialStatus>(
    page,
    "/examples/custom-material.html",
    "custom-material-initial-status",
  );

  if (firstStatus === undefined) {
    return;
  }

  await page.waitForFunction(
    () => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: CustomMaterialStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        (status.animation?.frame ?? 0) >= 3 &&
        (status.animation?.samples.length ?? 0) >= 2
      );
    },
    undefined,
    { timeout: 15000 },
  );

  const status = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: CustomMaterialStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("custom-material-animated-status", status);
  expect(status, "custom material status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "custom-material",
    scenario: "water-material",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    customMaterial: {
      family: "custom-water",
      sourceMaterialKey: "material:custom-water-material",
      materialResourceKey: "material:custom-water-material",
      validationDiagnostics: 0,
      diagnostics: 0,
    },
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    binding: { planned: 1, applied: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    readback: { ok: true },
  });
  expect(status.customMaterial?.pipelineKey).toContain("custom-water|shader:");
  expect(status.customMaterial?.bindGroupResourceKey).toContain(
    "custom-wgsl-bind-group:material:custom-water-material",
  );

  const samples = status.animation?.samples ?? [];
  const firstSample = samples[0];
  const lastSample = samples.at(-1);

  expect(
    firstSample,
    "expected at least one WaterMaterial sample",
  ).toBeDefined();
  expect(lastSample, "expected a later WaterMaterial sample").toBeDefined();

  if (firstSample === undefined || lastSample === undefined) {
    return;
  }

  expect(lastSample.frame).toBeGreaterThan(firstSample.frame);
  expect(lastSample.shaderTime).toBeGreaterThan(firstSample.shaderTime);
  expect(
    pixelDistance(firstSample.pixel, lastSample.pixel),
    `WaterMaterial center pixel should change over time; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(12);
  expect(lastSample.pixel.b).toBeGreaterThan(80);
  expect(lastSample.pixel.g).toBeGreaterThan(40);
  guard.expectNoWarnings();
});

test("custom material example reports typed source validation failures", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CustomMaterialStatus>(
    page,
    "/examples/custom-material.html?broken=wgsl",
    "custom-material-broken-wgsl-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "custom-material",
    scenario: "water-material",
    mode: "broken-wgsl",
    ok: false,
    phase: "validate-custom-material",
    reason: "custom-material-source-invalid",
    customMaterialValidation: {
      diagnostics: 1,
      codes: ["renderAsset.customWgslMaterial.missingFragmentEntryPoint"],
    },
  });
  guard.expectNoWarnings();
});
