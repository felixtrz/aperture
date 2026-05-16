import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

type RgbaTuple = readonly [number, number, number, number];

test("ECS browser example renders two texture-backed unlit materials", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=multi-textured-unlit");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("multi-textured-unlit-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "multi-textured-unlit",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, textures: 2, samplers: 2, bindGroups: 4 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    pipelines: { count: 1 },
    multiTextured: {
      left: {
        sampleId: "left-texture-red",
        materialKey: "material:multi-textured-red",
        textureKey: "texture:multi-red-albedo",
        samplerKey: "sampler:multi-red-nearest",
        expectedColor: [0.95, 0.1, 0.08, 1],
      },
      right: {
        sampleId: "right-texture-cyan",
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-cyan-nearest",
        expectedColor: [0.05, 0.85, 0.95, 1],
      },
    },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
    diagnosticCounts: { extraction: 0, resources: 0, draw: 0, submission: 0 },
  });
  expect(status.pipelines?.keys).toEqual([
    "unlit|baseColorTexture|opaque|back|less|none",
  ]);

  if (status.multiTextured === undefined || !status.readback?.ok) {
    test.skip(true, "Multi-textured unlit pixel assertion requires readback.");
    return;
  }

  const leftSample = status.readback.samples.find(
    (entry) => entry.id === status.multiTextured?.left.sampleId,
  );
  const rightSample = status.readback.samples.find(
    (entry) => entry.id === status.multiTextured?.right.sampleId,
  );

  expect(leftSample).toBeDefined();
  expect(rightSample).toBeDefined();

  if (leftSample === undefined || rightSample === undefined) {
    return;
  }

  const leftPixel = rgbaTupleToPixel(status.multiTextured.left.expectedColor);
  const rightPixel = rgbaTupleToPixel(status.multiTextured.right.expectedColor);

  expect(pixelDistance(leftSample.pixel, leftPixel)).toBeLessThan(60);
  expect(pixelDistance(rightSample.pixel, rightPixel)).toBeLessThan(60);
  expect(pixelDistance(leftSample.pixel, rightPixel)).toBeGreaterThan(60);
  expect(pixelDistance(rightSample.pixel, leftPixel)).toBeGreaterThan(60);
});

test("ECS browser example renders two textures with one shared sampler", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-sampler-multi-textured",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("shared-sampler-multi-textured-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-sampler-multi-textured",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, textures: 2, samplers: 1, bindGroups: 4 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    pipelines: { count: 1 },
    multiTextured: {
      sharedSamplerKey: "sampler:multi-red-nearest",
      left: {
        sampleId: "left-texture-red",
        materialKey: "material:multi-textured-red",
        textureKey: "texture:multi-red-albedo",
        samplerKey: "sampler:multi-red-nearest",
        expectedColor: [0.95, 0.1, 0.08, 1],
      },
      right: {
        sampleId: "right-texture-cyan",
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-red-nearest",
        expectedColor: [0.05, 0.85, 0.95, 1],
      },
    },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
    diagnosticCounts: { extraction: 0, resources: 0, draw: 0, submission: 0 },
  });

  if (status.multiTextured === undefined || !status.readback?.ok) {
    test.skip(
      true,
      "Shared-sampler multi-textured pixel assertion requires readback.",
    );
    return;
  }

  const leftSample = status.readback.samples.find(
    (entry) => entry.id === status.multiTextured?.left.sampleId,
  );
  const rightSample = status.readback.samples.find(
    (entry) => entry.id === status.multiTextured?.right.sampleId,
  );

  expect(leftSample).toBeDefined();
  expect(rightSample).toBeDefined();

  if (leftSample === undefined || rightSample === undefined) {
    return;
  }

  const leftPixel = rgbaTupleToPixel(status.multiTextured.left.expectedColor);
  const rightPixel = rgbaTupleToPixel(status.multiTextured.right.expectedColor);

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
