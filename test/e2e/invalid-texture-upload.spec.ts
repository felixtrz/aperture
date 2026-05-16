import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example reports invalid texture upload diagnostics", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=invalid-texture-upload",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("invalid-texture-upload-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

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
  });
  expect(status.submission).toBeUndefined();
  expect(status.command).toBeUndefined();
  expect(JSON.stringify(status)).not.toMatch(/GPU(Texture|Sampler|Buffer)/);
});

test("ECS browser example reports short texture upload diagnostics", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=short-texture-upload");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("short-texture-upload-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

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
  });
  expect(status.submission).toBeUndefined();
  expect(status.command).toBeUndefined();
  expect(JSON.stringify(status)).not.toMatch(/GPU(Texture|Sampler|Buffer)/);
});

test("ECS browser example reports invalid rows-per-image texture upload diagnostics", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=invalid-texture-rows-per-image",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("invalid-texture-rows-per-image-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

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
  });
  expect(status.submission).toBeUndefined();
  expect(status.command).toBeUndefined();
  expect(JSON.stringify(status)).not.toMatch(/GPU(Texture|Sampler|Buffer)/);
});
