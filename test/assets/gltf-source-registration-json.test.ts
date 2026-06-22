import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createGltfAssetMappingReport,
  gltfSourceAssetRegistrationReportToJson,
  gltfSourceAssetRegistrationReportToJsonValue,
  registerGltfSourceAssetsFromMappingReport,
} from "@aperture-engine/render";

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([1, 2, 3, 4]),
    bytesPerRow: 4,
  },
};

describe("glTF source asset registration report JSON", () => {
  it("serializes written handle keys without embedding source assets", () => {
    const registration = registerGltfSourceAssetsFromMappingReport({
      registry: new AssetRegistry(),
      report: createMappingReport(),
    });
    const json = gltfSourceAssetRegistrationReportToJsonValue(registration);

    expect(json).toMatchObject({
      valid: true,
      written: [
        {
          kind: "texture",
          plannedHandleKey: "gltf:texture:0:baseColorTexture",
          registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
        },
        {
          kind: "sampler",
          plannedHandleKey: "gltf:sampler:0:baseColorTexture",
          registeredHandleKey: "sampler:gltf:sampler:0:baseColorTexture",
        },
        {
          kind: "material",
          plannedHandleKey: "material:gltf:material:0",
          registeredHandleKey: "material:gltf:material:0",
          dependencyHandleKeys: [
            "texture:gltf:texture:0:baseColorTexture",
            "sampler:gltf:sampler:0:baseColorTexture",
          ],
        },
      ],
      skipped: [],
      diagnostics: [],
    });
    expect(JSON.stringify(json)).not.toContain("bytes");
    expect(JSON.stringify(json)).not.toContain("sourceData");
    expect(
      JSON.parse(gltfSourceAssetRegistrationReportToJson(registration)),
    ).toEqual(json);
  });

  it("serializes skipped entries and duplicate diagnostics", () => {
    const registry = new AssetRegistry();
    const duplicateTexture = createTextureHandle(
      "gltf:texture:0:baseColorTexture",
    );

    registry.register(duplicateTexture);
    registry.markReady(duplicateTexture, { preexisting: true });

    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: createMappingReport(),
    });
    const json = gltfSourceAssetRegistrationReportToJsonValue(registration);

    expect(json).toMatchObject({
      valid: false,
      skipped: [
        {
          kind: "texture",
          plannedHandleKey: "gltf:texture:0:baseColorTexture",
          registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
          reason: "gltfRegistration.duplicateAssetKey",
          diagnostics: [
            {
              code: "gltfRegistration.duplicateAssetKey",
              registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfRegistration.duplicateAssetKey",
          registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
        },
      ],
    });
    expect(
      JSON.parse(gltfSourceAssetRegistrationReportToJson(registration)),
    ).toEqual(json);
  });
});

function createMappingReport() {
  return createGltfAssetMappingReport({
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
}
