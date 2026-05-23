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
      clearcoatFactor: 0,
      clearcoatTexture: null,
      clearcoatRoughnessFactor: 0,
      transmissionFactor: 0,
      transmissionTexture: null,
      sheenColorFactor: [0, 0, 0],
      sheenColorTexture: null,
      sheenRoughnessFactor: 0,
      iridescenceFactor: 0,
      iridescenceTexture: null,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 400,
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

  it("maps KHR_materials_clearcoat scalar factors to StandardMaterial fields", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Clearcoat Paint",
        extensions: {
          KHR_materials_clearcoat: {
            clearcoatFactor: 0.9,
            clearcoatRoughnessFactor: 0.08,
          },
        },
        pbrMetallicRoughness: {
          metallicFactor: 0,
          roughnessFactor: 0.55,
        },
      },
      {
        materialKey: "material:clearcoat",
        extensionsRequired: ["KHR_materials_clearcoat"],
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Clearcoat Paint",
      metallicFactor: 0,
      roughnessFactor: 0.55,
      clearcoatFactor: 0.9,
      clearcoatTexture: null,
      clearcoatRoughnessFactor: 0.08,
    });
  });

  it("maps KHR_materials_clearcoat clearcoatTexture and warns on remaining unsupported texture slots", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        extensions: {
          KHR_materials_clearcoat: {
            clearcoatFactor: 1,
            clearcoatTexture: { index: 0 },
            clearcoatRoughnessTexture: { index: 1 },
            clearcoatNormalTexture: { index: 2 },
          },
        },
      },
      {
        materialKey: "material:clearcoat-textures",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.material).toMatchObject({
      kind: "standard",
      clearcoatFactor: 1,
      clearcoatTexture: {
        texture: createTextureHandle("texture-0"),
        sampler: createSamplerHandle("sampler-0"),
      },
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        field: "extensions.KHR_materials_clearcoat.clearcoatRoughnessTexture",
        extensionName: "KHR_materials_clearcoat",
      },
      {
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        field: "extensions.KHR_materials_clearcoat.clearcoatNormalTexture",
        extensionName: "KHR_materials_clearcoat",
      },
    ]);
  });

  it("maps KHR_materials_transmission scalar factors to StandardMaterial fields", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Thin Glass",
        extensions: {
          KHR_materials_transmission: {
            transmissionFactor: 0.72,
          },
        },
        pbrMetallicRoughness: {
          baseColorFactor: [0.65, 0.82, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.04,
        },
      },
      {
        materialKey: "material:transmission",
        extensionsRequired: ["KHR_materials_transmission"],
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Thin Glass",
      metallicFactor: 0,
      roughnessFactor: 0.04,
      transmissionFactor: 0.72,
      renderState: {
        alphaMode: "blend",
        depth: { write: false },
        blend: { preset: "alpha" },
      },
    });
  });

  it("maps KHR_materials_transmission transmissionTexture without unsupported-slot warnings", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        extensions: {
          KHR_materials_transmission: {
            transmissionFactor: 1,
            transmissionTexture: { index: 0 },
          },
        },
      },
      {
        materialKey: "material:transmission-texture",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.material).toMatchObject({
      kind: "standard",
      transmissionFactor: 1,
      transmissionTexture: {
        texture: createTextureHandle("texture-0"),
        sampler: createSamplerHandle("sampler-0"),
      },
    });
    expect(report.diagnostics).toEqual([]);
  });

  it("maps KHR_materials_sheen scalar factors to StandardMaterial fields", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Woven Fabric",
        extensions: {
          KHR_materials_sheen: {
            sheenColorFactor: [0.85, 0.42, 0.16],
            sheenRoughnessFactor: 0.38,
          },
        },
        pbrMetallicRoughness: {
          metallicFactor: 0,
          roughnessFactor: 0.75,
        },
      },
      {
        materialKey: "material:sheen",
        extensionsRequired: ["KHR_materials_sheen"],
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Woven Fabric",
      metallicFactor: 0,
      roughnessFactor: 0.75,
      sheenColorFactor: [0.85, 0.42, 0.16],
      sheenRoughnessFactor: 0.38,
    });
  });

  it("maps KHR_materials_sheen sheenColorTexture and warns for remaining unsupported texture slots", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        extensions: {
          KHR_materials_sheen: {
            sheenColorFactor: [1, 0.5, 0.2],
            sheenColorTexture: { index: 0, texCoord: 1 },
            sheenRoughnessTexture: { index: 1 },
          },
        },
      },
      {
        materialKey: "material:sheen-textures",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.material).toMatchObject({
      kind: "standard",
      sheenColorFactor: [1, 0.5, 0.2],
      sheenColorTexture: {
        texture: createTextureHandle("texture-0"),
        sampler: createSamplerHandle("sampler-0"),
        texCoord: 1,
      },
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        field: "extensions.KHR_materials_sheen.sheenRoughnessTexture",
        extensionName: "KHR_materials_sheen",
      },
    ]);
  });

  it("maps KHR_materials_iridescence scalar factors to StandardMaterial fields", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Soap Film",
        extensions: {
          KHR_materials_iridescence: {
            iridescenceFactor: 0.9,
            iridescenceIor: 1.42,
            iridescenceThicknessMinimum: 120,
            iridescenceThicknessMaximum: 520,
          },
        },
        pbrMetallicRoughness: {
          metallicFactor: 0,
          roughnessFactor: 0.18,
        },
      },
      {
        materialKey: "material:iridescence",
        extensionsRequired: ["KHR_materials_iridescence"],
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Soap Film",
      metallicFactor: 0,
      roughnessFactor: 0.18,
      iridescenceFactor: 0.9,
      iridescenceIor: 1.42,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 520,
    });
  });

  it("maps KHR_materials_iridescence iridescenceTexture and warns for remaining unsupported texture slots", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        extensions: {
          KHR_materials_iridescence: {
            iridescenceFactor: 1,
            iridescenceTexture: { index: 0 },
            iridescenceThicknessTexture: { index: 1 },
          },
        },
      },
      {
        materialKey: "material:iridescence-textures",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.material).toMatchObject({
      kind: "standard",
      iridescenceFactor: 1,
      iridescenceTexture: {
        texture: createTextureHandle("texture-0"),
        sampler: createSamplerHandle("sampler-0"),
      },
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        field:
          "extensions.KHR_materials_iridescence.iridescenceThicknessTexture",
        extensionName: "KHR_materials_iridescence",
      },
    ]);
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

  it("maps emissive factor without requiring an emissive texture", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Emissive Factor Only",
        emissiveFactor: [0.9, 0.25, 0.08],
        pbrMetallicRoughness: {
          baseColorFactor: [0.2, 0.2, 0.2, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
      { materialKey: "material:emissive-factor" },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Emissive Factor Only",
      metallicFactor: 0,
      roughnessFactor: 0.8,
      emissiveFactor: [0.9, 0.25, 0.08],
    });
    if (report.material?.kind !== "standard") {
      throw new Error("Expected StandardMaterial mapping.");
    }
    expect(Array.from(report.material.baseColorFactor)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.2),
      expect.closeTo(0.2),
      1,
    ]);
    expect(report.material.emissiveTexture).toBeNull();
  });

  it("reports invalid emissive factor without dropping the StandardMaterial", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        name: "Invalid Emissive Factor",
        emissiveFactor: [0.9, "hot", 0.08],
        pbrMetallicRoughness: {
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
      { materialKey: "material:invalid-emissive-factor" },
    );

    expect(report.valid).toBe(false);
    expect(report.material).toMatchObject({
      kind: "standard",
      label: "Invalid Emissive Factor",
      metallicFactor: 0,
      roughnessFactor: 0.8,
      emissiveFactor: [0, 0, 0],
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.invalidField",
        severity: "error",
        field: "emissiveFactor",
        value: "[object Array]",
      },
    ]);
    expect(JSON.parse(gltfMaterialMappingReportToJson(report))).toEqual(
      gltfMaterialMappingReportToJsonValue(report),
    );
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

  it("preserves supported base-color texture transforms without a mapping warning", () => {
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
    expect(report.diagnostics).toEqual([]);
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

  it("preserves supported base-color TEXCOORD_1 transforms without a mapping warning", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: {
            index: 0,
            texCoord: 1,
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
        materialKey: "material:transform-uv1",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      baseColorTexture: {
        texCoord: 1,
        transform: {
          offset: [0.25, 0.5],
          scale: [2, 1],
          rotation: 0.25,
        },
      },
    });
  });

  it("continues to warn for transformed texCoords above TEXCOORD_1", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: {
            index: 0,
            texCoord: 2,
            extensions: {
              KHR_texture_transform: {
                offset: [0.25, 0.5],
              },
            },
          },
        },
      },
      {
        materialKey: "material:transform-uv2",
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
        texCoord: 2,
        transform: {
          offset: [0.25, 0.5],
        },
      },
    });
  });

  it("preserves supported metallic-roughness transforms without a mapping warning", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          metallicRoughnessTexture: {
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
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      metallicRoughnessTexture: {
        transform: {
          offset: [0.25, 0.5],
          scale: [2, 1],
          rotation: 0.25,
        },
      },
    });
  });

  it("preserves supported normal transforms without a mapping warning", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        normalTexture: {
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
      {
        materialKey: "material:transform",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      normalTexture: {
        transform: {
          offset: [0.25, 0.5],
          scale: [2, 1],
          rotation: 0.25,
        },
      },
    });
  });

  it("preserves supported occlusion transforms without a mapping warning", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        occlusionTexture: {
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
      {
        materialKey: "material:transform",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      occlusionTexture: {
        transform: {
          offset: [0.25, 0.5],
          scale: [2, 1],
          rotation: 0.25,
        },
      },
    });
  });

  it("preserves supported emissive transforms without a mapping warning", () => {
    const report = createMaterialAssetFromGltfMaterial(
      {
        emissiveTexture: {
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
      {
        materialKey: "material:transform",
        resolveTextureBinding,
      },
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.material).toMatchObject({
      kind: "standard",
      emissiveTexture: {
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
        extensions: { KHR_materials_specular: {} },
        pbrMetallicRoughness: {
          baseColorTexture: { index: 2 },
        },
      },
      {
        materialKey: "material:bad",
        extensionsRequired: ["KHR_materials_specular"],
      },
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unsupportedRequiredExtension",
        severity: "error",
        extensionName: "KHR_materials_specular",
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
