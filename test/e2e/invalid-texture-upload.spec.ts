import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example reports invalid texture upload diagnostics", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "invalid-texture-upload",
    "invalid-texture-upload-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "invalid-texture-upload",
    ok: false,
    phase: "resources",
    reason: "texture-resources-unavailable",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    texture: {
      materialKey: "material:textured-unlit",
      textureKey: "texture:checker-albedo",
      samplerKey: "sampler:nearest-clamp",
    },
    invalidTextureUpload: {
      textureKey: "texture:checker-albedo",
      expectedDiagnostic: "textureResource.invalidBytesPerRow",
      bytesPerRow: 7,
    },
    diagnostics: [
      {
        code: "textureResource.invalidBytesPerRow",
        resourceKey: "texture:checker-albedo",
        message:
          "Texture upload bytesPerRow for resource 'texture:checker-albedo' must be at least 8 bytes for 2 texel(s) of 'rgba8unorm'.",
      },
    ],
    diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
  });
  expect(status.submission).toBeUndefined();
  expect(status.command).toBeUndefined();
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports short texture upload diagnostics", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "short-texture-upload",
    "short-texture-upload-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "short-texture-upload",
    ok: false,
    phase: "resources",
    reason: "texture-resources-unavailable",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    texture: {
      materialKey: "material:textured-unlit",
      textureKey: "texture:checker-albedo",
      samplerKey: "sampler:nearest-clamp",
    },
    invalidTextureUpload: {
      textureKey: "texture:checker-albedo",
      expectedDiagnostic: "textureResource.uploadDataTooSmall",
      bytesPerRow: 8,
      dataBytes: 15,
    },
    diagnostics: [
      {
        code: "textureResource.uploadDataTooSmall",
        resourceKey: "texture:checker-albedo",
        message:
          "Texture upload data for resource 'texture:checker-albedo' must contain at least 16 byte(s); received 15.",
      },
    ],
    diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
  });
  expect(status.submission).toBeUndefined();
  expect(status.command).toBeUndefined();
  expectStatusJsonSafeForGpu(status);
});

test("ECS browser example reports invalid rows-per-image texture upload diagnostics", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "invalid-texture-rows-per-image",
    "invalid-texture-rows-per-image-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "invalid-texture-rows-per-image",
    ok: false,
    phase: "resources",
    reason: "texture-resources-unavailable",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    texture: {
      materialKey: "material:textured-unlit",
      textureKey: "texture:checker-albedo",
      samplerKey: "sampler:nearest-clamp",
    },
    invalidTextureUpload: {
      textureKey: "texture:checker-albedo",
      expectedDiagnostic: "textureResource.invalidRowsPerImage",
      bytesPerRow: 8,
      rowsPerImage: 1,
    },
    diagnostics: [
      {
        code: "textureResource.invalidRowsPerImage",
        resourceKey: "texture:checker-albedo",
        message:
          "Texture upload rowsPerImage for resource 'texture:checker-albedo' must be an integer at least 2 row(s).",
      },
    ],
    diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
  });
  expect(status.submission).toBeUndefined();
  expect(status.command).toBeUndefined();
  expectStatusJsonSafeForGpu(status);
});
