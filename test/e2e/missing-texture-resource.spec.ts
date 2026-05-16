import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

type DiagnosticResourcePair = {
  readonly code: string;
  readonly resourceKey?: string;
};

test("ECS browser example reports missing texture and sampler GPU resources", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "missing-texture-sampler-resources",
    "missing-texture-sampler-resources-status",
  );

  if (status === undefined) {
    return;
  }

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
    diagnosticCounts: expectedDiagnosticCounts({ resources: 2 }),
  });
  expect(
    status.diagnostics?.map((diagnostic) => diagnostic.code),
    JSON.stringify(status, null, 2),
  ).toEqual([
    "unlitBindGroupResource.missingTextureResource",
    "unlitBindGroupResource.missingSamplerResource",
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports one missing texture resource among multiple textured draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "multi-textured-missing-texture-resource",
    "multi-textured-missing-texture-resource",
  );

  if (status === undefined) {
    return;
  }

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
    diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
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
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports a missing shared sampler resource", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "shared-texture-missing-sampler-resource",
    "shared-texture-missing-sampler-resource",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-missing-sampler-resource",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 1,
      samplers: 0,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
    },
    missingSamplerResource: {
      samplerKey: "sampler:shared-tint-nearest",
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 2 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:shared-tint-nearest",
    },
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:shared-tint-nearest",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports a missing shared texture resource", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "shared-texture-missing-texture-resource",
    "shared-texture-missing-texture-resource",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-missing-texture-resource",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 0,
      samplers: 1,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
    },
    missingTextureResource: {
      textureKey: "texture:shared-tint-albedo",
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 2 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:shared-tint-albedo",
    },
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:shared-tint-albedo",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports one missing sampler resource among multiple textured draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "multi-textured-missing-sampler-resource",
    "multi-textured-missing-sampler-resource",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "multi-textured-missing-sampler-resource",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 2,
      samplers: 1,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    multiTextured: {
      right: {
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-cyan-nearest",
      },
    },
    missingSamplerResource: {
      samplerKey: "sampler:multi-cyan-nearest",
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
  });
  expect(status.diagnostics).toMatchObject([
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:multi-cyan-nearest",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports missing texture and sampler resources for one textured draw", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "multi-textured-missing-texture-sampler-resources",
    "multi-textured-missing-texture-sampler-resources",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "multi-textured-missing-texture-sampler-resources",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 1,
      samplers: 1,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    multiTextured: {
      right: {
        materialKey: "material:multi-textured-cyan",
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-cyan-nearest",
      },
    },
    missingTextureResource: {
      textureKey: "texture:multi-cyan-albedo",
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    missingSamplerResource: {
      samplerKey: "sampler:multi-cyan-nearest",
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 2 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:multi-cyan-albedo",
    },
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:multi-cyan-nearest",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports missing shared texture and sampler resources", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "shared-texture-missing-texture-sampler-resources",
    "shared-texture-missing-texture-sampler-resources",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-texture-missing-texture-sampler-resources",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 0,
      samplers: 0,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    sharedTextureTinted: {
      textureKey: "texture:shared-tint-albedo",
      samplerKey: "sampler:shared-tint-nearest",
    },
    missingTextureResource: {
      textureKey: "texture:shared-tint-albedo",
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    missingSamplerResource: {
      samplerKey: "sampler:shared-tint-nearest",
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 4 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:shared-tint-albedo",
    },
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:shared-tint-nearest",
    },
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:shared-tint-albedo",
    },
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:shared-tint-nearest",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports a missing shared sampler resource across two textured draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "shared-sampler-missing-sampler-resource",
    "shared-sampler-missing-sampler-resource",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-sampler-missing-sampler-resource",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 2,
      samplers: 0,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    multiTextured: {
      sharedSamplerKey: "sampler:multi-red-nearest",
      left: { samplerKey: "sampler:multi-red-nearest" },
      right: { samplerKey: "sampler:multi-red-nearest" },
    },
    missingSamplerResource: {
      samplerKey: "sampler:multi-red-nearest",
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 2 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:multi-red-nearest",
    },
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:multi-red-nearest",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports one missing texture resource in a shared-sampler scene", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "shared-sampler-missing-texture-resource",
    "shared-sampler-missing-texture-resource",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-sampler-missing-texture-resource",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 1,
      samplers: 1,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    multiTextured: {
      sharedSamplerKey: "sampler:multi-red-nearest",
      right: {
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-red-nearest",
      },
    },
    missingTextureResource: {
      textureKey: "texture:multi-cyan-albedo",
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:multi-cyan-albedo",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports missing texture and shared sampler resources in a shared-sampler scene", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "shared-sampler-missing-texture-sampler-resources",
    "shared-sampler-missing-texture-sampler-resources",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "shared-sampler-missing-texture-sampler-resources",
    ok: false,
    phase: "resources",
    reason: "frame-resources-unavailable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: {
      materials: 0,
      textures: 1,
      samplers: 0,
      bindGroups: 0,
      missing: "texture/sampler",
    },
    multiTextured: {
      sharedSamplerKey: "sampler:multi-red-nearest",
      right: {
        textureKey: "texture:multi-cyan-albedo",
        samplerKey: "sampler:multi-red-nearest",
      },
    },
    missingTextureResource: {
      textureKey: "texture:multi-cyan-albedo",
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    missingSamplerResource: {
      samplerKey: "sampler:multi-red-nearest",
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
    diagnosticCounts: expectedDiagnosticCounts({ resources: 3 }),
  });
  expect(
    diagnosticResourcePairs(status),
    JSON.stringify(status, null, 2),
  ).toEqual([
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:multi-red-nearest",
    },
    {
      code: "unlitBindGroupResource.missingTextureResource",
      resourceKey: "texture:multi-cyan-albedo",
    },
    {
      code: "unlitBindGroupResource.missingSamplerResource",
      resourceKey: "sampler:multi-red-nearest",
    },
  ]);
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
});

function diagnosticResourcePairs(
  status: MultiEntityExampleStatus,
): readonly DiagnosticResourcePair[] | undefined {
  return status.diagnostics?.map((diagnostic) => ({
    code: diagnostic.code,
    ...(diagnostic.resourceKey === undefined
      ? {}
      : { resourceKey: diagnostic.resourceKey }),
  }));
}
