import { describe, expect, it } from "vitest";

import {
  createGltfAssetMappingReport,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
} from "@aperture-engine/core";

const decodedImage = {
  width: 2,
  height: 2,
  sourceData: {
    bytes: new Uint8Array(16),
    bytesPerRow: 8,
  },
};

describe("glTF asset mapping orchestration report", () => {
  it("plans texture, sampler, and material handles without registering assets", () => {
    const report = createGltfAssetMappingReport({
      root: {
        asset: { version: "2.0" },
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
        textures: [{ source: 0, sampler: 0 }],
        images: [{ bufferView: 1, mimeType: "image/png" }],
        samplers: [
          {
            wrapS: GLTF_SAMPLER_WRAP.REPEAT,
            wrapT: GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
            magFilter: GLTF_SAMPLER_FILTER.LINEAR,
            minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
          },
        ],
      },
      resolveImageData: () => decodedImage,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.textures).toMatchObject([
      {
        handleKey: "gltf:texture:0:baseColorTexture",
        textureIndex: 0,
        slot: "baseColorTexture",
        texture: { semantic: "base-color", colorSpace: "srgb" },
      },
    ]);
    expect(report.samplers).toMatchObject([
      {
        handleKey: "gltf:sampler:0:baseColorTexture",
        sampler: { addressModeV: "clamp-to-edge" },
      },
    ]);
    expect(report.materials).toMatchObject([
      {
        handleKey: "material:gltf:material:0",
        materialIndex: 0,
        material: {
          kind: "standard",
          baseColorTexture: {
            texture: createTextureHandle("gltf:texture:0:baseColorTexture"),
            sampler: createSamplerHandle("gltf:sampler:0:baseColorTexture"),
          },
        },
      },
    ]);
    expect(createMaterialHandle("gltf:material:0")).toEqual({
      kind: "material",
      id: "gltf:material:0",
    });
  });

  it("maps glTF alpha mode and double-sided flags into material render state", () => {
    const report = createGltfAssetMappingReport({
      root: {
        asset: { version: "2.0" },
        materials: [
          {},
          { alphaMode: "MASK", alphaCutoff: 0.25 },
          { alphaMode: "MASK" },
          { alphaMode: "BLEND" },
          { doubleSided: true },
        ],
      },
      resolveImageData: () => decodedImage,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.materials).toMatchObject([
      {
        materialIndex: 0,
        material: {
          kind: "standard",
          renderState: {
            alphaMode: "opaque",
            alphaCutoff: 0.5,
            cullMode: "back",
            depth: { test: true, write: true, compare: "less" },
            blend: { preset: "none" },
          },
        },
      },
      {
        materialIndex: 1,
        material: {
          kind: "standard",
          renderState: {
            alphaMode: "mask",
            alphaCutoff: 0.25,
            cullMode: "back",
            depth: { test: true, write: true, compare: "less" },
            blend: { preset: "none" },
          },
        },
      },
      {
        materialIndex: 2,
        material: {
          kind: "standard",
          renderState: {
            alphaMode: "mask",
            alphaCutoff: 0.5,
            cullMode: "back",
          },
        },
      },
      {
        materialIndex: 3,
        material: {
          kind: "standard",
          renderState: {
            alphaMode: "blend",
            alphaCutoff: 0.5,
            cullMode: "back",
            depth: { test: true, write: false, compare: "less" },
            blend: { preset: "alpha" },
          },
        },
      },
      {
        materialIndex: 4,
        material: {
          kind: "standard",
          renderState: {
            alphaMode: "opaque",
            alphaCutoff: 0.5,
            cullMode: "none",
          },
        },
      },
    ]);
  });

  it("preserves root, texture, and material diagnostics with source context", () => {
    const report = createGltfAssetMappingReport({
      root: {
        asset: { version: "1.0" },
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
        textures: [{ source: 0, sampler: 3 }],
        images: [{ bufferView: 1, mimeType: "image/png" }],
        samplers: [],
      },
      resolveImageData: () => decodedImage,
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        layer: "root",
        code: "gltfRoot.unsupportedVersion",
        field: "asset.version",
      },
      {
        layer: "texture",
        code: "gltfTexture.invalidSamplerIndex",
        textureIndex: 0,
        samplerIndex: 3,
        slot: "baseColorTexture",
      },
      {
        layer: "material",
        code: "gltfMaterial.unresolvedTextureBinding",
        textureIndex: 0,
        samplerIndex: 3,
        slot: "baseColorTexture",
      },
    ]);
  });
});
