import { describe, expect, it } from "vitest";

import {
  createTextureAssetFromGltfTexture,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  gltfTextureMappingReportToJson,
  gltfTextureMappingReportToJsonValue,
  type GltfImageDataResolver,
} from "@aperture-engine/core";

const decodedImage = {
  width: 2,
  height: 2,
  sourceData: {
    bytes: new Uint8Array(16),
    bytesPerRow: 8,
  },
};

const resolveImageData: GltfImageDataResolver = () => decodedImage;

describe("glTF texture mapping", () => {
  it("maps decoded GLB bufferView image data into a TextureAsset and SamplerAsset", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0, sampler: 0, name: "BaseColorTexture" }],
      images: [{ bufferView: 2, mimeType: "image/png" }],
      samplers: [
        {
          wrapS: GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
          wrapT: GLTF_SAMPLER_WRAP.REPEAT,
          magFilter: GLTF_SAMPLER_FILTER.LINEAR,
          minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        },
      ],
      resolveImageData,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report).toMatchObject({
      textureIndex: 0,
      imageIndex: 0,
      samplerIndex: 0,
      texture: {
        label: "BaseColorTexture",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
      },
      sampler: {
        addressModeU: "clamp-to-edge",
        addressModeV: "repeat",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      },
    });
    expect(report.texture?.sourceData?.bytes.byteLength).toBe(16);
  });

  it("maps data texture slots to data color space and default sampler state", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "normalTexture",
      textures: [{ source: 0 }],
      images: [{ uri: "normal.png" }],
      resolveImageData,
    });

    expect(report.valid).toBe(true);
    expect(report.sampler).toMatchObject({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    });
    expect(report.texture).toMatchObject({
      semantic: "normal",
      colorSpace: "data",
      format: "rgba8unorm",
    });
  });

  it("reports unsupported texture extensions and resolver failures", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "emissiveTexture",
      textures: [
        {
          source: 0,
          extensions: { KHR_texture_basisu: { source: 1 } },
        },
      ],
      images: [{ bufferView: 4, mimeType: "image/png" }],
      extensionsRequired: ["KHR_texture_basisu"],
      resolveImageData: () => ({
        diagnostics: [
          {
            message: "Decoded image data was not available.",
          },
        ],
      }),
    });

    expect(report.valid).toBe(false);
    expect(report.texture).toBeNull();
    expect(report.sampler).toMatchObject({ kind: "sampler" });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfTexture.unsupportedRequiredTextureExtension",
        severity: "error",
        extensionName: "KHR_texture_basisu",
      },
      {
        code: "gltfTexture.imageResolverFailed",
        severity: "error",
        imageIndex: 0,
        message: "Decoded image data was not available.",
      },
    ]);
  });

  it("reports invalid image and sampler metadata with JSON-safe output", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "metallicRoughnessTexture",
      textures: [{ source: 0, sampler: 1 }],
      images: [{ bufferView: 2, mimeType: "image/webp" }],
      samplers: [{}, "bad"],
      resolveImageData,
    });

    expect(report.valid).toBe(false);
    expect(report.texture).toBeNull();
    expect(report.sampler).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfTexture.invalidSamplerIndex",
        severity: "error",
        field: "samplers[1]",
        samplerIndex: 1,
      },
      {
        code: "gltfTexture.unsupportedImageMimeType",
        severity: "error",
        imageIndex: 0,
        value: "image/webp",
      },
    ]);
    expect(JSON.parse(gltfTextureMappingReportToJson(report))).toEqual(
      gltfTextureMappingReportToJsonValue(report),
    );
  });
});
