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

test("ECS browser example reports one missing texture asset among multiple textured materials", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=multi-textured-missing-texture-asset",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("multi-textured-missing-texture-asset", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "multi-textured-missing-texture-asset",
    ok: false,
    phase: "extract",
    reason: "multi-textured-missing-texture-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 1 },
    assetStatus: {
      texture: "missing",
      diagnostics: ["render.texture.missing"],
      registryDiagnostics: [],
    },
    textureDependency: {
      dependencyKind: "texture",
      assetStatus: "missing",
      textureKey: "texture:multi-cyan-albedo",
      samplerKey: "sampler:multi-cyan-nearest",
    },
    multiTextured: {
      right: {
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-cyan-nearest",
      },
    },
    missingTextureAsset: {
      materialKey: "material:multi-textured-cyan",
      textureKey: "texture:multi-cyan-albedo",
      samplerKey: "sampler:multi-cyan-nearest",
      expectedDiagnostic: "render.texture.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "texture" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 1,
      ready: 0,
      blocked: 1,
      diagnostics: [
        "renderWorld.missingMeshResource",
        "renderWorld.missingMaterialResource",
      ],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    [
      {
        code: "render.texture.missing",
        assetKey: "texture:multi-cyan-albedo",
      },
    ],
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports one missing sampler asset among multiple textured materials", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=multi-textured-missing-sampler-asset",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("multi-textured-missing-sampler-asset", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "multi-textured-missing-sampler-asset",
    ok: false,
    phase: "extract",
    reason: "multi-textured-missing-sampler-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 1 },
    assetStatus: {
      sampler: "missing",
      diagnostics: ["render.sampler.missing"],
      registryDiagnostics: [],
    },
    textureDependency: {
      dependencyKind: "sampler",
      assetStatus: "missing",
      textureKey: "texture:multi-cyan-albedo",
      samplerKey: "sampler:multi-cyan-nearest",
    },
    multiTextured: {
      right: {
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-cyan-nearest",
      },
    },
    missingSamplerAsset: {
      materialKey: "material:multi-textured-cyan",
      textureKey: "texture:multi-cyan-albedo",
      samplerKey: "sampler:multi-cyan-nearest",
      expectedDiagnostic: "render.sampler.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "sampler" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 1,
      ready: 0,
      blocked: 1,
      diagnostics: [
        "renderWorld.missingMeshResource",
        "renderWorld.missingMaterialResource",
      ],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    [
      {
        code: "render.sampler.missing",
        assetKey: "sampler:multi-cyan-nearest",
      },
    ],
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports one missing texture asset with a shared sampler", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-sampler-missing-texture-asset",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("shared-sampler-missing-texture-asset", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-sampler-missing-texture-asset",
    ok: false,
    phase: "extract",
    reason: "shared-sampler-missing-texture-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 1 },
    assetStatus: {
      texture: "missing",
      diagnostics: ["render.texture.missing"],
      registryDiagnostics: [],
    },
    textureDependency: {
      dependencyKind: "texture",
      assetStatus: "missing",
      textureKey: "texture:multi-cyan-albedo",
      samplerKey: "sampler:multi-red-nearest",
    },
    multiTextured: {
      sharedSamplerKey: "sampler:multi-red-nearest",
      left: { samplerKey: "sampler:multi-red-nearest" },
      right: {
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-red-nearest",
      },
    },
    missingTextureAsset: {
      materialKey: "material:multi-textured-cyan",
      textureKey: "texture:multi-cyan-albedo",
      samplerKey: "sampler:multi-red-nearest",
      expectedDiagnostic: "render.texture.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "texture" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 1,
      ready: 0,
      blocked: 1,
      diagnostics: [
        "renderWorld.missingMeshResource",
        "renderWorld.missingMaterialResource",
      ],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    [
      {
        code: "render.texture.missing",
        assetKey: "texture:multi-cyan-albedo",
      },
    ],
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports a missing shared sampler asset", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-sampler-missing-sampler-asset",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("shared-sampler-missing-sampler-asset", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-sampler-missing-sampler-asset",
    ok: false,
    phase: "extract",
    reason: "shared-sampler-missing-sampler-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 2 },
    assetStatus: {
      sampler: "missing",
      diagnostics: ["render.sampler.missing", "render.sampler.missing"],
      registryDiagnostics: [],
    },
    textureDependency: {
      dependencyKind: "sampler",
      assetStatus: "missing",
      textureKey: "texture:multi-red-albedo",
      samplerKey: "sampler:multi-red-nearest",
    },
    multiTextured: {
      sharedSamplerKey: "sampler:multi-red-nearest",
      left: { samplerKey: "sampler:multi-red-nearest" },
      right: { samplerKey: "sampler:multi-red-nearest" },
    },
    missingSharedSamplerAsset: {
      samplerKey: "sampler:multi-red-nearest",
      expectedDiagnostic: "render.sampler.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "sampler" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 0,
      ready: 0,
      blocked: 0,
      diagnostics: ["renderWorld.empty"],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    [
      {
        code: "render.sampler.missing",
        assetKey: "sampler:multi-red-nearest",
      },
      {
        code: "render.sampler.missing",
        assetKey: "sampler:multi-red-nearest",
      },
    ],
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports a missing shared texture asset", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-texture-missing-texture-asset",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("shared-texture-missing-texture-asset", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-missing-texture-asset",
    ok: false,
    phase: "extract",
    reason: "shared-texture-missing-texture-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 2 },
    assetStatus: {
      texture: "missing",
      diagnostics: ["render.texture.missing", "render.texture.missing"],
      registryDiagnostics: [],
    },
    textureDependency: {
      dependencyKind: "texture",
      assetStatus: "missing",
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
    },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
      left: { materialKey: "material:shared-tint-warm" },
      right: { materialKey: "material:shared-tint-cool" },
    },
    missingSharedTextureAsset: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
      expectedDiagnostic: "render.texture.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "texture" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 0,
      ready: 0,
      blocked: 0,
      diagnostics: ["renderWorld.empty"],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.missingSharedTextureAsset?.textureKey).toBe(
    "texture:shared-tint-albedo",
  );
  expect(status.missingSharedTextureAsset?.samplerKey).toBe(
    "sampler:shared-tint-nearest",
  );
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    repeatedPerRenderableAssetDiagnostics([
      {
        code: "render.texture.missing",
        assetKey: "texture:shared-tint-albedo",
      },
    ]),
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports a missing shared texture sampler asset", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-texture-missing-sampler-asset",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("shared-texture-missing-sampler-asset", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-missing-sampler-asset",
    ok: false,
    phase: "extract",
    reason: "shared-texture-missing-sampler-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 2 },
    assetStatus: {
      sampler: "missing",
      diagnostics: ["render.sampler.missing", "render.sampler.missing"],
      registryDiagnostics: [],
    },
    textureDependency: {
      dependencyKind: "sampler",
      assetStatus: "missing",
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
    },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
      left: { materialKey: "material:shared-tint-warm" },
      right: { materialKey: "material:shared-tint-cool" },
    },
    missingSharedSamplerAsset: {
      samplerKey: "sampler:shared-tint-nearest",
      expectedDiagnostic: "render.sampler.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "sampler" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 0,
      ready: 0,
      blocked: 0,
      diagnostics: ["renderWorld.empty"],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.missingSharedSamplerAsset?.samplerKey).toBe(
    "sampler:shared-tint-nearest",
  );
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    repeatedPerRenderableAssetDiagnostics([
      {
        code: "render.sampler.missing",
        assetKey: "sampler:shared-tint-nearest",
      },
    ]),
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
});

test("ECS browser example reports missing shared texture and sampler assets", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=shared-texture-missing-texture-sampler-assets",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus(
    "shared-texture-missing-texture-sampler-assets",
    status,
  );

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-missing-texture-sampler-assets",
    ok: false,
    phase: "extract",
    reason: "shared-texture-missing-texture-sampler-assets",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 4 },
    assetStatus: {
      texture: "missing",
      sampler: "missing",
      diagnostics: [
        "render.texture.missing",
        "render.sampler.missing",
        "render.texture.missing",
        "render.sampler.missing",
      ],
      registryDiagnostics: [],
    },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
      left: { materialKey: "material:shared-tint-warm" },
      right: { materialKey: "material:shared-tint-cool" },
    },
    missingSharedTextureAsset: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
      expectedDiagnostic: "render.texture.missing",
    },
    missingSharedSamplerAsset: {
      samplerKey: "sampler:shared-tint-nearest",
      expectedDiagnostic: "render.sampler.missing",
    },
    resources: { materials: 0, bindGroups: 0, missing: "texture/sampler" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 0,
      ready: 0,
      blocked: 0,
      diagnostics: ["renderWorld.empty"],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.missingSharedTextureAsset?.textureKey).toBe(
    "texture:shared-tint-albedo",
  );
  expect(status.missingSharedSamplerAsset?.samplerKey).toBe(
    "sampler:shared-tint-nearest",
  );
  expect(assetDiagnosticPairs(status), JSON.stringify(status, null, 2)).toEqual(
    repeatedPerRenderableAssetDiagnostics([
      {
        code: "render.texture.missing",
        assetKey: "texture:shared-tint-albedo",
      },
      {
        code: "render.sampler.missing",
        assetKey: "sampler:shared-tint-nearest",
      },
    ]),
  );
  expect(status.resources?.textures).toBeUndefined();
  expect(status.resources?.samplers).toBeUndefined();
  expect(
    JSON.stringify(status),
    "status must not expose raw GPU handles",
  ).not.toMatch(/GPUTexture|GPUTextureView|GPUSampler|createBindGroup/);
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

function assetDiagnosticPairs(status: MultiEntityExampleStatus):
  | readonly {
      readonly code: string;
      readonly assetKey?: string;
    }[]
  | undefined {
  return status.diagnostics?.map((diagnostic) => ({
    code: diagnostic.code,
    ...(diagnostic.assetKey === undefined
      ? {}
      : { assetKey: diagnostic.assetKey }),
  }));
}

function repeatedPerRenderableAssetDiagnostics(
  diagnostics: readonly {
    readonly code: string;
    readonly assetKey: string;
  }[],
  renderableCount = 2,
): readonly {
  readonly code: string;
  readonly assetKey: string;
}[] {
  return Array.from({ length: renderableCount }).flatMap(() => diagnostics);
}
