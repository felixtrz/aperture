import { describe, expect, it } from "vitest";

import {
  createGltfAssetMappingReport,
  gltfAssetMappingReportToJson,
  gltfAssetMappingReportToJsonValue,
} from "@aperture-engine/core";

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([1, 2, 3, 4]),
    bytesPerRow: 4,
  },
};

describe("glTF asset mapping report JSON", () => {
  it("keeps planned handles and summarizes nested texture payloads", () => {
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
        textures: [{ source: 0 }],
        images: [{ bufferView: 1, mimeType: "image/png" }],
      },
      resolveImageData: () => decodedImage,
    });
    const json = gltfAssetMappingReportToJsonValue(report);

    expect(json).toMatchObject({
      valid: true,
      textures: [
        {
          handleKey: "gltf:texture:0:baseColorTexture",
          texture: {
            sourceData: {
              byteLength: 4,
              bytesPerRow: 4,
            },
          },
        },
      ],
      samplers: [{ handleKey: "gltf:sampler:0:baseColorTexture" }],
      materials: [{ handleKey: "material:gltf:material:0" }],
      diagnostics: [],
    });
    expect(JSON.stringify(json)).not.toContain('"bytes"');
    expect(JSON.parse(gltfAssetMappingReportToJson(report))).toEqual(json);
  });

  it("preserves orchestration diagnostics in JSON", () => {
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
        textures: [{ source: 0, sampler: 9 }],
        images: [{ bufferView: 1, mimeType: "image/png" }],
        samplers: [],
      },
      resolveImageData: () => decodedImage,
    });

    expect(gltfAssetMappingReportToJsonValue(report).diagnostics).toMatchObject(
      [
        {
          layer: "root",
          code: "gltfRoot.unsupportedVersion",
        },
        {
          layer: "texture",
          code: "gltfTexture.invalidSamplerIndex",
          textureIndex: 0,
          samplerIndex: 9,
        },
        {
          layer: "material",
          code: "gltfMaterial.unresolvedTextureBinding",
          textureIndex: 0,
          samplerIndex: 9,
        },
      ],
    );
  });
});
