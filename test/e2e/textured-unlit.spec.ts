import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
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
    diagnosticCounts: { extraction: 0, resources: 0, draw: 0, submission: 0 },
  });

  if (status.texture === undefined || !status.readback?.ok) {
    test.skip(true, "Textured unlit pixel assertion requires readback.");
    return;
  }

  const leftSample = status.readback.samples.find(
    (sample) => sample.id === "left-red",
  );
  const rightSample = status.readback.samples.find(
    (sample) => sample.id === "right-blue",
  );
  const leftPixel = rgbaColorToPixel({
    r: status.texture.expectedLeftColor[0],
    g: status.texture.expectedLeftColor[1],
    b: status.texture.expectedLeftColor[2],
    a: status.texture.expectedLeftColor[3],
  });
  const rightPixel = rgbaColorToPixel({
    r: status.texture.expectedRightColor[0],
    g: status.texture.expectedRightColor[1],
    b: status.texture.expectedRightColor[2],
    a: status.texture.expectedRightColor[3],
  });

  expect(
    leftSample,
    `expected left texture sample; status=${JSON.stringify(status, null, 2)}`,
  ).toBeDefined();
  expect(
    rightSample,
    `expected right texture sample; status=${JSON.stringify(status, null, 2)}`,
  ).toBeDefined();

  if (leftSample === undefined || rightSample === undefined) {
    return;
  }

  expect(
    pixelDistance(leftSample.pixel, leftPixel),
    `left sample should match texture left column; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(80);
  expect(
    pixelDistance(rightSample.pixel, rightPixel),
    `right sample should match texture right column; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(80);
  expect(pixelDistance(leftSample.pixel, rightPixel)).toBeGreaterThan(80);
  expect(pixelDistance(rightSample.pixel, leftPixel)).toBeGreaterThan(80);
});
