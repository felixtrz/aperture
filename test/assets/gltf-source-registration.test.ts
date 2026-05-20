import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createGltfAssetMappingReport,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
  gltfSourceAssetRegistrationReportToJsonValue,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  registerGltfSourceAssetsFromMappingReport,
} from "@aperture-engine/core";

const decodedImage = {
  width: 2,
  height: 2,
  sourceData: {
    bytes: new Uint8Array(16),
    bytesPerRow: 8,
  },
};

describe("glTF source asset registration", () => {
  it("registers successful planned texture, sampler, and material source assets", () => {
    const registry = new AssetRegistry();
    const mapping = createValidMappingReport();
    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: mapping,
    });

    expect(registration.valid).toBe(true);
    expect(registration.skipped).toEqual([]);
    expect(registration.written).toMatchObject([
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
    ]);

    const texture = createTextureHandle("gltf:texture:0:baseColorTexture");
    const sampler = createSamplerHandle("gltf:sampler:0:baseColorTexture");
    const material = createMaterialHandle("gltf:material:0");

    expect(registry.getStatus(texture)).toBe("ready");
    expect(registry.getStatus(sampler)).toBe("ready");
    expect(registry.getStatus(material)).toBe("ready");
    expect(registry.get(texture)?.asset).toBe(mapping.textures[0]?.texture);
    expect(registry.get(sampler)?.asset).toBe(mapping.samplers[0]?.sampler);
    expect(registry.get(material)?.asset).toBe(mapping.materials[0]?.material);
    expect(registry.get(material)?.dependencies).toEqual([texture, sampler]);
    expect(
      JSON.stringify(
        gltfSourceAssetRegistrationReportToJsonValue(registration),
      ),
    ).not.toContain("bytes");
  });

  it("skips duplicate keys without overwriting existing assets", () => {
    const registry = new AssetRegistry();
    const mapping = createValidMappingReport();
    const existingTexture = createTextureHandle(
      "gltf:texture:0:baseColorTexture",
    );
    const existingTextureAsset = { alreadyRegistered: true };

    registry.register(existingTexture);
    registry.markReady(existingTexture, existingTextureAsset);

    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: mapping,
    });

    expect(registration.valid).toBe(false);
    expect(registration.skipped).toMatchObject([
      {
        kind: "texture",
        reason: "gltfRegistration.duplicateAssetKey",
        registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
      },
    ]);
    expect(registration.written.map((entry) => entry.kind)).toEqual([
      "sampler",
      "material",
    ]);
    expect(registry.get(existingTexture)?.asset).toBe(existingTextureAsset);
    expect(
      registry.get(createMaterialHandle("gltf:material:0"))?.dependencies,
    ).toEqual([
      existingTexture,
      createSamplerHandle("gltf:sampler:0:baseColorTexture"),
    ]);
  });

  it("promotes pre-registered loading texture assets to ready", () => {
    const registry = new AssetRegistry();
    const mapping = createValidMappingReport();
    const loadingTexture = createTextureHandle(
      "gltf:texture:0:baseColorTexture",
    );

    registry.register(loadingTexture);
    registry.markLoading(loadingTexture);

    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: mapping,
    });

    expect(registration.valid).toBe(true);
    expect(registration.skipped).toEqual([]);
    expect(registration.written[0]).toMatchObject({
      kind: "texture",
      registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
    });
    expect(registry.getStatus(loadingTexture)).toBe("ready");
    expect(registry.get(loadingTexture)?.asset).toBe(
      mapping.textures[0]?.texture,
    );
  });

  it("skips invalid planned entries without mutating the registry", () => {
    const registry = new AssetRegistry();
    const mapping = createGltfAssetMappingReport({
      root: {
        asset: { version: "2.0" },
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

    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: mapping,
    });

    expect(registration.valid).toBe(false);
    expect(registration.written).toEqual([]);
    expect(registration.skipped.map((entry) => entry.kind)).toEqual([
      "texture",
      "sampler",
      "material",
    ]);
    expect(registration.diagnostics.map((entry) => entry.code)).toEqual([
      "gltfRegistration.invalidPlannedAsset",
      "gltfRegistration.invalidPlannedAsset",
      "gltfRegistration.invalidPlannedAsset",
    ]);
    expect(registry.list()).toEqual([]);
  });
});

function createValidMappingReport() {
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
}
