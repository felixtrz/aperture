import { describe, expect, it } from "vitest";

import {
  createMaterialAssetFromGltfMaterial,
  createSamplerHandle,
  createTextureHandle,
  gltfMaterialMappingReportToJson,
  gltfMaterialMappingReportToJsonValue,
  type GltfMaterialTextureBindingResolver,
} from "@aperture-engine/core";

const resolveTextureBinding: GltfMaterialTextureBindingResolver = (input) => ({
  texture: createTextureHandle(`texture-${input.textureIndex}`),
  sampler: createSamplerHandle(`sampler-${input.textureIndex}`),
});

describe("glTF material mapping", () => {
  it("maps a default glTF material to a StandardMaterial asset", () => {
    const report = createMaterialAssetFromGltfMaterial(
      { name: "Default Standard" },
      { materialKey: "material:0" },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Default Standard",
      metallicFactor: 1,
      roughnessFactor: 1,
      normalScale: 1,
      occlusionStrength: 1,
      emissiveFactor: [0, 0, 0],
      renderState: {
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        cullMode: "back",
        blend: { preset: "none" },
      },
    });
  });

  it("maps metallic-roughness texture slots through caller-provided handles", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.25, 0.5, 0.75, 0.8],
          baseColorTexture: { index: 0, texCoord: 1 },
          metallicFactor: 0.4,
          roughnessFactor: 0.7,
          metallicRoughnessTexture: { index: 1 },
        },
        normalTexture: { index: 2, scale: 0.5 },
        occlusionTexture: { index: 3, strength: 0.6 },
        emissiveFactor: [0.1, 0.2, 0.3],
        emissiveTexture: { index: 4 },
        alphaMode: "BLEND",
        doubleSided: true,
      },
      {
        materialKey: "material:1",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.material).toMatchObject({
      kind: "standard",
      metallicFactor: 0.4,
      roughnessFactor: 0.7,
      normalScale: 0.5,
      occlusionStrength: 0.6,
      emissiveFactor: [0.1, 0.2, 0.3],
      renderState: {
        alphaMode: "blend",
        cullMode: "none",
        depth: { write: false },
        blend: { preset: "alpha" },
      },
      baseColorTexture: {
        texture: createTextureHandle("texture-0"),
        sampler: createSamplerHandle("sampler-0"),
        texCoord: 1,
      },
      metallicRoughnessTexture: {
        texture: createTextureHandle("texture-1"),
        sampler: createSamplerHandle("sampler-1"),
        texCoord: 0,
      },
      normalTexture: {
        texture: createTextureHandle("texture-2"),
        sampler: createSamplerHandle("sampler-2"),
      },
      occlusionTexture: {
        texture: createTextureHandle("texture-3"),
        sampler: createSamplerHandle("sampler-3"),
      },
      emissiveTexture: {
        texture: createTextureHandle("texture-4"),
        sampler: createSamplerHandle("sampler-4"),
      },
    });
  });

  it("maps KHR_materials_unlit to an UnlitMaterial asset", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Unlit Sign",
        extensions: { KHR_materials_unlit: {} },
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0.8, 0.2, 1],
          baseColorTexture: { index: 7 },
          metallicFactor: 0,
        },
        normalTexture: { index: 8 },
      },
      {
        materialKey: "material:unlit",
        extensionsRequired: ["KHR_materials_unlit"],
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.material).toMatchObject({
      kind: "unlit",
      label: "Unlit Sign",
      baseColorTexture: {
        texture: createTextureHandle("texture-7"),
        sampler: createSamplerHandle("sampler-7"),
      },
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "gltfMaterial.unsupportedUnlitField",
      "gltfMaterial.unsupportedUnlitField",
    ]);
  });

  it("maps explicit opaque and mask alpha state with cull defaults", () => {
    const opaque = createMaterialAssetFromGltfMaterial({
      alphaMode: "OPAQUE",
      doubleSided: false,
    });
    const masked = createMaterialAssetFromGltfMaterial({
      alphaMode: "MASK",
      alphaCutoff: 0.25,
    });

    expect(opaque.valid).toBe(true);
    expect(opaque.material).toMatchObject({
      kind: "standard",
      renderState: {
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        cullMode: "back",
        depth: { write: true },
        blend: { preset: "none" },
      },
    });
    expect(masked.valid).toBe(true);
    expect(masked.material).toMatchObject({
      kind: "standard",
      renderState: {
        alphaMode: "mask",
        alphaCutoff: 0.25,
        cullMode: "back",
        depth: { write: true },
        blend: { preset: "none" },
      },
    });
  });

  it("reports invalid alpha and cull fields", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        alphaMode: "CUTOUT",
        alphaCutoff: 1.5,
        doubleSided: "true",
      },
      { materialKey: "material:render-state" },
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.invalidField",
        severity: "error",
        field: "alphaMode",
        value: "CUTOUT",
      },
      {
        code: "gltfMaterial.invalidField",
        severity: "error",
        field: "doubleSided",
        value: "true",
      },
      {
        code: "gltfMaterial.invalidField",
        severity: "error",
        field: "alphaCutoff",
        value: 1.5,
      },
    ]);
    expect(report.material).toMatchObject({
      kind: "standard",
      renderState: {
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        cullMode: "back",
      },
    });
  });

  it("preserves texture transforms and reports current shader limits", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: {
            index: 0,
            extensions: {
              KHR_texture_transform: {
                offset: [0.25, 0.5],
                scale: [2, 1],
                rotation: 0.25,
              },
            },
          },
        },
      },
      {
        materialKey: "material:transform",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unsupportedTextureTransform",
        severity: "warning",
        field:
          "pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform",
        slot: "baseColorTexture",
        textureIndex: 0,
      },
    ]);
    expect(report.material).toMatchObject({
      kind: "standard",
      baseColorTexture: {
        transform: {
          offset: [0.25, 0.5],
          scale: [2, 1],
          rotation: 0.25,
        },
      },
    });
  });

  it("preserves supported base-color offset and scale transforms without a mapping warning", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: {
            index: 0,
            extensions: {
              KHR_texture_transform: {
                offset: [0.25, 0.5],
                scale: [2, 1],
              },
            },
          },
        },
      },
      {
        materialKey: "material:transform",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      baseColorTexture: {
        transform: {
          offset: [0.25, 0.5],
          scale: [2, 1],
        },
      },
    });
  });

  it("reports unsupported required extensions and unresolved texture handles", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        extensions: { KHR_materials_clearcoat: {} },
        pbrMetallicRoughness: {
          baseColorTexture: { index: 2 },
        },
      },
      {
        materialKey: "material:bad",
        extensionsRequired: ["KHR_materials_clearcoat"],
      },
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unsupportedRequiredExtension",
        severity: "error",
        extensionName: "KHR_materials_clearcoat",
      },
      {
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        field: "pbrMetallicRoughness.baseColorTexture",
        slot: "baseColorTexture",
        textureIndex: 2,
      },
    ]);
    expect(JSON.parse(gltfMaterialMappingReportToJson(report))).toEqual(
      gltfMaterialMappingReportToJsonValue(report),
    );
  });

  it("accepts resolver diagnostics for missing texture and sampler lookups", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 10 },
          metallicRoughnessTexture: { index: 11 },
        },
      },
      {
        materialKey: "material:resolver",
        resolveTextureBinding: (input) =>
          input.slot === "baseColorTexture"
            ? {
                diagnostics: [
                  {
                    dependencyKind: "texture",
                    message: "Texture index 10 was not mapped.",
                  },
                ],
              }
            : {
                diagnostics: [
                  {
                    dependencyKind: "sampler",
                    samplerIndex: 3,
                    message: "Sampler index 3 was not mapped.",
                  },
                ],
              },
      },
    );

    expect(report.valid).toBe(false);
    expect(report.material).toMatchObject({
      kind: "standard",
      baseColorTexture: null,
      metallicRoughnessTexture: null,
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        field: "pbrMetallicRoughness.baseColorTexture",
        slot: "baseColorTexture",
        dependencyKind: "texture",
        textureIndex: 10,
        message: "Texture index 10 was not mapped.",
      },
      {
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        field: "pbrMetallicRoughness.metallicRoughnessTexture",
        slot: "metallicRoughnessTexture",
        dependencyKind: "sampler",
        textureIndex: 11,
        samplerIndex: 3,
        message: "Sampler index 3 was not mapped.",
      },
    ]);
  });

  it("reports malformed material sub-objects without silently defaulting them", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        extensions: [],
        pbrMetallicRoughness: "bad",
      },
      { materialKey: "material:malformed" },
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.invalidField",
        severity: "error",
        field: "extensions",
        value: "[object Array]",
      },
      {
        code: "gltfMaterial.invalidField",
        severity: "error",
        field: "pbrMetallicRoughness",
        value: "bad",
      },
    ]);
  });
});
