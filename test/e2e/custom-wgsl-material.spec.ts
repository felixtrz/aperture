import { expect, test } from "@playwright/test";

import type { SingleDrawExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import { sampleCanvasCenterPresentation } from "./webgpu-presentation.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";

interface CustomWgslMaterialStatus extends SingleDrawExampleStatus {
  readonly customMaterial?: {
    readonly family: string;
    readonly sourceMaterialKey: string;
    readonly materialResourceKey: string;
    readonly pipelineKey: string;
    readonly bindGroupResourceKey: string;
    readonly uniformColor: readonly [number, number, number, number];
    readonly diagnostics: number;
  };
}

test("custom WGSL material route renders through the full WebGPU draw path", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CustomWgslMaterialStatus>(
    page,
    "/examples/triangle.html?material=custom-wgsl",
    "custom-wgsl-material-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "custom-wgsl-material",
    scenario: "custom-wgsl",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    customMaterial: {
      family: "custom-water",
      sourceMaterialKey: "material:triangle",
      materialResourceKey: "material:triangle",
      diagnostics: 0,
    },
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    binding: { planned: 1, applied: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
  });
  expect(status.customMaterial?.pipelineKey).toContain("custom-water|shader:");
  expect(status.customMaterial?.bindGroupResourceKey).toContain(
    "custom-wgsl-bind-group:material:triangle",
  );

  if (status.clearColor === undefined) {
    return;
  }

  const clearPixel = rgbaColorToPixel(status.clearColor);

  if (status.readback?.ok) {
    const centerSample = status.readback.samples.find(
      (sample) => sample.id === "center",
    );

    expect(
      centerSample,
      `expected custom WGSL center readback sample; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeDefined();

    if (centerSample === undefined) {
      return;
    }

    expectCustomShaderPixel(centerSample.pixel, clearPixel, status);
    guard.expectNoWarnings();
    return;
  }

  const presentation = await sampleCanvasCenterPresentation(
    page.locator("#aperture-canvas"),
  );

  await attachExampleStatus("custom-wgsl-material-presentation", presentation);
  test.skip(presentation.samplesCssBackground, presentation.diagnostic);
  expectCustomShaderPixel(presentation.centerPixel, clearPixel, status);
  guard.expectNoWarnings();
});

function expectCustomShaderPixel(
  pixel: { readonly r: number; readonly g: number; readonly b: number },
  clearPixel: ReturnType<typeof rgbaColorToPixel>,
  status: CustomWgslMaterialStatus,
): void {
  expect(
    pixelDistance({ ...pixel, a: 255 }, clearPixel),
    `custom WGSL pixel should differ from clear color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(120);
  expect(
    pixel.g,
    "custom WGSL green channel should carry the uniform",
  ).toBeGreaterThan(150);
  expect(
    pixel.b,
    "custom WGSL blue channel should carry the uniform",
  ).toBeGreaterThan(210);
}
