import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example renders factor-only and textured unlit pipeline variants", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "mixed-unlit-pipelines",
    "mixed-unlit-pipelines-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "mixed-unlit-pipelines",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, textures: 1, samplers: 1, bindGroups: 6 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    pipelines: { count: 2 },
    texture: {
      materialKey: "material:mixed-textured-unlit",
      textureKey: "texture:mixed-checker-albedo",
      samplerKey: "sampler:mixed-nearest-clamp",
    },
    mixedPipelines: {
      factorMaterialKey: "material:mixed-factor-unlit",
      texturedMaterialKey: "material:mixed-textured-unlit",
    },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.pipelines?.keys).toEqual(
    expect.arrayContaining([
      "unlit|opaque|back|less|none",
      "unlit|baseColorTexture|opaque|back|less|none",
    ]),
  );

  if (status.mixedPipelines === undefined || !status.readback?.ok) {
    test.skip(true, "Mixed unlit pipeline pixel assertion requires readback.");
    return;
  }

  const factorSample = status.readback.samples.find(
    (sample) => sample.id === "factor-green",
  );
  const textureSample = status.readback.samples.find(
    (sample) => sample.id === "texture-blue",
  );
  const factorPixel = rgbaColorToPixel({
    r: status.mixedPipelines.expectedFactorColor[0],
    g: status.mixedPipelines.expectedFactorColor[1],
    b: status.mixedPipelines.expectedFactorColor[2],
    a: status.mixedPipelines.expectedFactorColor[3],
  });
  const texturePixel = rgbaColorToPixel({
    r: status.mixedPipelines.expectedTexturedColor[0],
    g: status.mixedPipelines.expectedTexturedColor[1],
    b: status.mixedPipelines.expectedTexturedColor[2],
    a: status.mixedPipelines.expectedTexturedColor[3],
  });

  expect(
    factorSample,
    `expected factor-only sample; status=${JSON.stringify(status, null, 2)}`,
  ).toBeDefined();
  expect(
    textureSample,
    `expected texture-backed sample; status=${JSON.stringify(status, null, 2)}`,
  ).toBeDefined();

  if (factorSample === undefined || textureSample === undefined) {
    return;
  }

  expect(
    pixelDistance(factorSample.pixel, factorPixel),
    `factor-only sample should match material color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(80);
  expect(
    pixelDistance(textureSample.pixel, texturePixel),
    `texture-backed sample should match texture color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(80);
  expect(pixelDistance(factorSample.pixel, texturePixel)).toBeGreaterThan(80);
  expect(pixelDistance(textureSample.pixel, factorPixel)).toBeGreaterThan(80);
});
