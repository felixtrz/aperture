import { describe, expect, it } from "vitest";

import {
  createMaterialAssetFromGltfMaterial,
  createSamplerAssetFromGltfSampler,
  createTextureAssetFromGltfTexture,
  gltfMaterialMappingReportToJsonValue,
  gltfSamplerMappingReportToJsonValue,
  gltfTextureMappingReportToJsonValue,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
} from "@aperture-engine/core";

describe("glTF helper report JSON fixtures", () => {
  it("summarizes texture source data without raw bytes", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0 }],
      images: [{ bufferView: 1, mimeType: "image/png" }],
      resolveImageData: () => ({
        width: 1,
        height: 1,
        sourceData: {
          bytes: new Uint8Array([1, 2, 3, 4]),
          bytesPerRow: 4,
        },
      }),
    });
    const json = gltfTextureMappingReportToJsonValue(report);

    expect(json.texture?.sourceData).toEqual({
      byteLength: 4,
      bytesPerRow: 4,
    });
    expect(JSON.stringify(json)).not.toContain('"bytes"');
  });

  it("keeps sampler report JSON compact and enum-oriented", () => {
    const report = createSamplerAssetFromGltfSampler({
      wrapS: GLTF_SAMPLER_WRAP.MIRRORED_REPEAT,
      wrapT: GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
      magFilter: GLTF_SAMPLER_FILTER.NEAREST,
      minFilter: GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_LINEAR,
    });

    expect(gltfSamplerMappingReportToJsonValue(report)).toMatchObject({
      valid: true,
      sampler: {
        addressModeU: "mirror-repeat",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "linear",
      },
      diagnostics: [],
    });
  });

  it("preserves material diagnostic context in JSON values", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 2 },
        },
      },
      {
        materialKey: "material:json",
        resolveTextureBinding: () => ({
          diagnostics: [
            {
              dependencyKind: "sampler",
              samplerIndex: 5,
              message: "Sampler index 5 was not mapped.",
            },
          ],
        }),
      },
    );

    expect(gltfMaterialMappingReportToJsonValue(report).diagnostics).toEqual([
      {
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        materialKey: "material:json",
        field: "pbrMetallicRoughness.baseColorTexture",
        slot: "baseColorTexture",
        textureIndex: 2,
        message: "Sampler index 5 was not mapped.",
        dependencyKind: "sampler",
        samplerIndex: 5,
      },
    ]);
  });
});
