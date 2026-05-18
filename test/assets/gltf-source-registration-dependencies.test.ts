import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createGltfAssetMappingReport,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
  registerGltfSourceAssetsFromMappingReport,
} from "@aperture-engine/core";

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([255, 255, 255, 255]),
    bytesPerRow: 4,
  },
};

describe("glTF source asset registration dependencies", () => {
  it("records material dependency edges for registered texture bindings", () => {
    const registry = new AssetRegistry();
    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: createMappingReport(),
    });

    expect(registration.valid).toBe(true);
    expect(registry.createManifestReport().dependencies).toEqual([
      {
        from: "material:gltf:material:0",
        to: "texture:gltf:texture:0:baseColorTexture",
      },
      {
        from: "material:gltf:material:0",
        to: "sampler:gltf:sampler:0:baseColorTexture",
      },
    ]);
  });

  it("treats duplicate texture and sampler assets as satisfied dependencies", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("gltf:texture:0:baseColorTexture");
    const sampler = createSamplerHandle("gltf:sampler:0:baseColorTexture");

    registry.register(texture);
    registry.markReady(texture, { preexistingTexture: true });
    registry.register(sampler);
    registry.markReady(sampler, { preexistingSampler: true });

    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: createMappingReport(),
    });

    expect(registration.valid).toBe(false);
    expect(registration.skipped.map((entry) => entry.reason)).toEqual([
      "gltfRegistration.duplicateAssetKey",
      "gltfRegistration.duplicateAssetKey",
    ]);
    expect(registration.written).toMatchObject([
      {
        kind: "material",
        registeredHandleKey: "material:gltf:material:0",
        dependencyHandleKeys: [
          "texture:gltf:texture:0:baseColorTexture",
          "sampler:gltf:sampler:0:baseColorTexture",
        ],
      },
    ]);
    expect(
      registry.get(createMaterialHandle("gltf:material:0"))?.dependencies,
    ).toEqual([texture, sampler]);
  });

  it("skips material registration when planned dependencies are absent", () => {
    const registry = new AssetRegistry();
    const mapping = createMappingReport();
    const registration = registerGltfSourceAssetsFromMappingReport({
      registry,
      report: {
        ...mapping,
        textures: [],
        samplers: [],
      },
    });

    expect(registration.valid).toBe(false);
    expect(registration.written).toEqual([]);
    expect(registration.skipped).toMatchObject([
      {
        kind: "material",
        reason: "gltfRegistration.missingDependency",
        registeredHandleKey: "material:gltf:material:0",
      },
    ]);
    expect(registration.diagnostics).toMatchObject([
      {
        code: "gltfRegistration.missingDependency",
        dependencyKey: "texture:gltf:texture:0:baseColorTexture",
      },
    ]);
    expect(registry.list()).toEqual([]);
  });

  it("skips invalid GLB texture dependency plans without material edges for every StandardMaterial slot", () => {
    for (const slot of standardTextureSlots) {
      const registry = new AssetRegistry();
      const registration = registerGltfSourceAssetsFromMappingReport({
        registry,
        report: createGltfAssetMappingReport({
          root: rootForSlot(slot, {
            textures: [{ source: 7, sampler: 0 }],
            images: [],
            samplers: [{}],
          }),
          resolveImageData: () => decodedImage,
        }),
      });

      expect(registration.valid).toBe(false);
      expect(registration.written).toEqual([]);
      expect(registration.skipped).toMatchObject([
        {
          kind: "texture",
          reason: "gltfRegistration.invalidPlannedAsset",
          registeredHandleKey: `texture:gltf:texture:0:${slot.slot}`,
          textureIndex: 0,
          slot: slot.slot,
        },
        {
          kind: "sampler",
          reason: "gltfRegistration.invalidPlannedAsset",
          registeredHandleKey: `sampler:gltf:sampler:0:${slot.slot}`,
          textureIndex: 0,
          slot: slot.slot,
        },
        {
          kind: "material",
          reason: "gltfRegistration.invalidPlannedAsset",
          registeredHandleKey: "material:gltf:material:0",
          materialIndex: 0,
        },
      ]);
      expect(registry.get(createMaterialHandle("gltf:material:0"))).toBe(
        undefined,
      );
      expect(registry.createManifestReport().dependencies).toEqual([]);
    }
  });

  it("skips invalid GLB sampler dependency plans without material edges for every StandardMaterial slot", () => {
    for (const slot of standardTextureSlots) {
      const registry = new AssetRegistry();
      const registration = registerGltfSourceAssetsFromMappingReport({
        registry,
        report: createGltfAssetMappingReport({
          root: rootForSlot(slot, {
            textures: [{ source: 0, sampler: 5 }],
            images: [{ bufferView: 1, mimeType: "image/png" }],
            samplers: [],
          }),
          resolveImageData: () => decodedImage,
        }),
      });

      expect(registration.valid).toBe(false);
      expect(registration.written).toEqual([]);
      expect(registration.diagnostics).toMatchObject([
        {
          code: "gltfRegistration.invalidPlannedAsset",
          kind: "texture",
          registeredHandleKey: `texture:gltf:texture:0:${slot.slot}`,
          textureIndex: 0,
          slot: slot.slot,
        },
        {
          code: "gltfRegistration.invalidPlannedAsset",
          kind: "sampler",
          registeredHandleKey: `sampler:gltf:sampler:0:${slot.slot}`,
          textureIndex: 0,
          slot: slot.slot,
        },
        {
          code: "gltfRegistration.invalidPlannedAsset",
          kind: "material",
          registeredHandleKey: "material:gltf:material:0",
          materialIndex: 0,
        },
      ]);
      expect(registry.get(createMaterialHandle("gltf:material:0"))).toBe(
        undefined,
      );
      expect(registry.createManifestReport().dependencies).toEqual([]);
    }
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

const standardTextureSlots = [
  { slot: "baseColorTexture" },
  { slot: "metallicRoughnessTexture" },
  { slot: "normalTexture" },
  { slot: "occlusionTexture" },
  { slot: "emissiveTexture" },
] as const;

function rootForSlot(
  slot: (typeof standardTextureSlots)[number],
  source: {
    readonly textures: readonly unknown[];
    readonly images: readonly unknown[];
    readonly samplers: readonly unknown[];
  },
) {
  const textureInfo = { index: 0 };
  const material =
    slot.slot === "baseColorTexture" || slot.slot === "metallicRoughnessTexture"
      ? {
          pbrMetallicRoughness: {
            [slot.slot]: textureInfo,
          },
        }
      : {
          [slot.slot]: textureInfo,
        };

  return {
    asset: { version: "2.0" },
    materials: [material],
    textures: source.textures,
    images: source.images,
    samplers: source.samplers,
  };
}
