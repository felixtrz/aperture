import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

type RgbaTuple = readonly [number, number, number, number];

test("ECS browser example multiplies texture color by unlit tint", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=textured-unlit-tint");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("textured-unlit-tint-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "textured-unlit-tint",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, textures: 1, samplers: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    texture: {
      materialKey: "material:textured-unlit-tint",
      textureKey: "texture:tint-albedo",
      samplerKey: "sampler:tint-nearest-clamp",
    },
    texturedTint: {
      materialKey: "material:textured-unlit-tint",
      textureKey: "texture:tint-albedo",
      samplerKey: "sampler:tint-nearest-clamp",
      sampleId: "tinted-texture",
      textureColor: [0.8, 0.6, 0.4, 1],
      tintFactor: [0.5, 0.25, 0.75, 1],
      expectedColor: [0.4, 0.15, 0.3, 1],
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: { extraction: 0, resources: 0, draw: 0, submission: 0 },
  });

  if (status.texturedTint === undefined || !status.readback?.ok) {
    test.skip(true, "Textured tint pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples.find(
    (entry) => entry.id === status.texturedTint?.sampleId,
  );

  expect(
    sample,
    `expected tinted texture readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (sample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaTupleToPixel(status.texturedTint.expectedColor),
    ),
    `textured unlit sample should match texture multiplied by tint; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(60);
  expect(
    pixelDistance(
      sample.pixel,
      rgbaTupleToPixel(status.texturedTint.textureColor),
    ),
  ).toBeGreaterThan(60);
  expect(
    pixelDistance(
      sample.pixel,
      rgbaTupleToPixel(status.texturedTint.tintFactor),
    ),
  ).toBeGreaterThan(60);
});

test("ECS browser example renders two tints from one shared texture", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-texture-tinted-unlit",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("shared-texture-tinted-unlit-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-tinted-unlit",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, textures: 1, samplers: 1, bindGroups: 4 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
      textureColor: [0.8, 0.6, 0.4, 1],
      left: {
        sampleId: "left-shared-tint",
        materialKey: "material:shared-tint-warm",
        tintFactor: [1, 0.5, 0.5, 1],
        expectedColor: [0.8, 0.3, 0.2, 1],
      },
      right: {
        sampleId: "right-shared-tint",
        materialKey: "material:shared-tint-cool",
        tintFactor: [0.25, 1, 0.5, 1],
        expectedColor: [0.2, 0.6, 0.2, 1],
      },
    },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
    diagnosticCounts: { extraction: 0, resources: 0, draw: 0, submission: 0 },
  });

  if (status.sharedTextureTinted === undefined || !status.readback?.ok) {
    test.skip(true, "Shared texture tint pixel assertion requires readback.");
    return;
  }

  const leftSample = status.readback.samples.find(
    (entry) => entry.id === status.sharedTextureTinted?.left.sampleId,
  );
  const rightSample = status.readback.samples.find(
    (entry) => entry.id === status.sharedTextureTinted?.right.sampleId,
  );

  expect(leftSample).toBeDefined();
  expect(rightSample).toBeDefined();

  if (leftSample === undefined || rightSample === undefined) {
    return;
  }

  const leftPixel = rgbaTupleToPixel(
    status.sharedTextureTinted.left.expectedColor,
  );
  const rightPixel = rgbaTupleToPixel(
    status.sharedTextureTinted.right.expectedColor,
  );

  expect(pixelDistance(leftSample.pixel, leftPixel)).toBeLessThan(60);
  expect(pixelDistance(rightSample.pixel, rightPixel)).toBeLessThan(60);
  expect(pixelDistance(leftSample.pixel, rightPixel)).toBeGreaterThan(60);
  expect(pixelDistance(rightSample.pixel, leftPixel)).toBeGreaterThan(60);
});

function rgbaTupleToPixel(
  color: RgbaTuple,
): ReturnType<typeof rgbaColorToPixel> {
  return rgbaColorToPixel({
    r: color[0],
    g: color[1],
    b: color[2],
    a: color[3],
  });
}
