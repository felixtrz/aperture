import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example samples a texture-backed unlit material", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=textured-unlit");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("textured-unlit-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "textured-unlit",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, textures: 1, samplers: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    texture: {
      materialKey: "material:textured-unlit",
      textureKey: "texture:checker-albedo",
      samplerKey: "sampler:nearest-clamp",
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.texture?.expectedQuadrants).toEqual([
    {
      sampleId: "upper-left-green",
      expectedColor: [0.09375, 0.875, 0.3125, 1],
    },
    {
      sampleId: "upper-right-yellow",
      expectedColor: [1, 0.90625, 0.09375, 1],
    },
    {
      sampleId: "lower-left-red",
      expectedColor: [1, 0.125, 0.0625, 1],
    },
    {
      sampleId: "lower-right-blue",
      expectedColor: [0.09375, 0.5, 1, 1],
    },
  ]);

  if (status.texture === undefined || !status.readback?.ok) {
    test.skip(true, "Textured unlit pixel assertion requires readback.");
    return;
  }

  expect(
    status.texture.expectedQuadrants,
    `expected texture quadrant metadata; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toHaveLength(4);

  const expectedQuadrants = status.texture.expectedQuadrants;

  if (expectedQuadrants === undefined) {
    return;
  }

  for (const quadrant of expectedQuadrants) {
    const sample = status.readback.samples.find(
      (entry) => entry.id === quadrant.sampleId,
    );
    const expectedPixel = rgbaTupleToPixel(quadrant.expectedColor);
    const otherPixels = expectedQuadrants
      .filter((entry) => entry.sampleId !== quadrant.sampleId)
      .map((entry) => rgbaTupleToPixel(entry.expectedColor));

    expect(
      sample,
      `expected ${quadrant.sampleId} texture sample; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeDefined();

    if (sample === undefined) {
      continue;
    }

    expect(
      pixelDistance(sample.pixel, expectedPixel),
      `${quadrant.sampleId} should match its expected texture quadrant; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeLessThan(80);

    for (const otherPixel of otherPixels) {
      expect(pixelDistance(sample.pixel, otherPixel)).toBeGreaterThan(80);
    }
  }
});

function rgbaTupleToPixel(
  color: readonly [number, number, number, number],
): ReturnType<typeof rgbaColorToPixel> {
  return rgbaColorToPixel({
    r: color[0],
    g: color[1],
    b: color[2],
    a: color[3],
  });
}
