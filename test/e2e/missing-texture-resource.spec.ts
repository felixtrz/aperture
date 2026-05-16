import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example reports missing texture and sampler GPU resources", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=missing-texture-sampler-resources",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("missing-texture-sampler-resources-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-texture-sampler-resources",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 0,
      samplers: 0,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    texture: {
      materialKey: "material:textured-unlit",
      textureKey: "texture:checker-albedo",
      samplerKey: "sampler:nearest-clamp",
    },
  });
  expect(
    status.diagnostics?.map((diagnostic) => diagnostic.code),
    JSON.stringify(status, null, 2),
  ).toEqual([
    "unlitBindGroupResource.missingTextureResource",
    "unlitBindGroupResource.missingSamplerResource",
  ]);
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports one missing texture resource among multiple textured draws", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=multi-textured-missing-texture-resource",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("multi-textured-missing-texture-resource", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "multi-textured-missing-texture-resource",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 1,
      samplers: 2,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    missingTextureResource: {
      textureKey: "texture:multi-cyan-albedo",
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
  });
  expect(status.multiTextured?.right.textureKey).toBe(
    "texture:multi-cyan-albedo",
  );
  expect(status.diagnostics).toMatchObject([
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:multi-cyan-albedo",
    },
  ]);
  expect(status.submission).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});
