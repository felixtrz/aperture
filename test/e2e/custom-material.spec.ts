import { expect, test } from "@playwright/test";

import type { SingleDrawExampleStatus } from "./example-status-types.js";
import { pixelDistance, readPngPixel } from "./png.js";
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
    readonly shaderAssetKey?: string;
    readonly materialResourceKey: string;
    readonly pipelineKey: string;
    readonly bindGroupResourceKey: string;
    readonly bindingCount?: number;
    readonly diagnostics: number;
    readonly diagnosticsByCode?: Readonly<Record<string, number>>;
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
  readonly rendering?: {
    readonly drawPackages: number;
    readonly drawCommands: number;
    readonly drawCalls: number;
  };
}

// The custom-WGSL material's per-frame `time` uniform reaches the GPU and the
// water visibly animates (verified: rendered output changes by ~300 sampled-
// pixel units over ~2.5s). The old version-key-staleness blocker was fixed in
// the custom-WGSL preparation refactor; the test is live again.
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
    renderingBackend: "webgpu-app-route",
    customMaterial: {
      family: "example/water",
      sourceMaterialKey: "material:custom-water-material",
      shaderAssetKey: "shader:custom-water-shader",
      bindingCount: 1,
      diagnostics: 0,
    },
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    rendering: { drawPackages: 1, drawCalls: 1 },
    readback: { ok: true },
  });
  expect(status.rendering?.drawCommands).toBeGreaterThan(0);
  // The custom-WGSL pipeline key is `<family>|<sorted features incl. bindings:…
  // and specialization:…>|<render state>` — there is no `shader:` segment (the
  // pipeline-key format reshaped since this spec was written; pinned by the gated
  // test/materials/key-format-contract.test.ts).
  expect(status.customMaterial?.pipelineKey).toContain("example/water|");
  expect(status.customMaterial?.pipelineKey).toContain("specialization:");
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
  expect(lastSample.pixel.b).toBeGreaterThan(80);
  expect(lastSample.pixel.g).toBeGreaterThan(40);

  // The shader's `time` uniform reaches the GPU and the water visibly animates.
  // A single fixed center pixel is a fragile probe — the animation moves the
  // ripple pattern around, so the exact center can stay near-constant while the
  // frame as a whole changes by hundreds of units. Compare two whole frames a
  // couple seconds apart over a wide grid and require a real change.
  const beforeShot = await page.locator("#aperture-canvas").screenshot();
  await page.waitForTimeout(2500);
  const afterShot = await page.locator("#aperture-canvas").screenshot();
  let maxFrameDelta = 0;
  for (let gy = 0; gy < 17; gy += 1) {
    for (let gx = 0; gx < 17; gx += 1) {
      const xRatio = 0.15 + (0.7 * gx) / 16;
      const yRatio = 0.15 + (0.7 * gy) / 16;
      maxFrameDelta = Math.max(
        maxFrameDelta,
        pixelDistance(
          readPngPixel(beforeShot, xRatio, yRatio),
          readPngPixel(afterShot, xRatio, yRatio),
        ),
      );
    }
  }
  expect(
    maxFrameDelta,
    "WaterMaterial should animate: the rendered frame must change over time",
  ).toBeGreaterThan(12);
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
    phase: "render",
    reason: "custom-material-render-failed",
    renderingBackend: "webgpu-app-route",
    customMaterial: {
      family: "example/water",
      sourceMaterialKey: "material:custom-water-material",
      shaderAssetKey: "shader:custom-water-shader",
    },
  });
  expect(status.customMaterial?.diagnosticsByCode).toMatchObject({
    "customWgslMaterial.shaderDiagnostic": 1,
    "customWgslMaterial.shaderCreationFailed": 1,
  });
  guard.expectNoWarnings();
});
