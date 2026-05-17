import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createSamplerAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createStandardMaterialTextureReadinessReport,
  createTextureAsset,
  createTextureHandle,
  standardMaterialTextureReadinessReportToJson,
  standardMaterialTextureReadinessReportToJsonValue,
  AssetRegistry,
} from "@aperture-engine/core";

describe("StandardMaterial texture semantic and color-space readiness", () => {
  it("accepts glTF-aligned StandardMaterial texture metadata", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const sampler = createSamplerHandle("linear");
    const baseColor = createTextureHandle("base-color");
    const metallicRoughness = createTextureHandle("metallic-roughness");
    const normal = createTextureHandle("normal");
    const occlusion = createTextureHandle("occlusion");
    const emissive = createTextureHandle("emissive");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, baseColor, "base-color", "srgb");
    readyTexture(registry, metallicRoughness, "metallic-roughness", "data");
    readyTexture(registry, normal, "normal", "linear");
    readyTexture(registry, occlusion, "occlusion", "data");
    readyTexture(registry, emissive, "emissive", "srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture: baseColor, sampler },
        metallicRoughnessTexture: { texture: metallicRoughness, sampler },
        normalTexture: { texture: normal, sampler },
        occlusionTexture: { texture: occlusion, sampler },
        emissiveTexture: { texture: emissive, sampler },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });
    const json = standardMaterialTextureReadinessReportToJsonValue(report);

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toMatchObject([
      {
        field: "baseColorTexture",
        textureKey: "texture:base-color",
        expectedSemantic: "base-color",
        actualSemantic: "base-color",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "srgb",
      },
      {
        field: "metallicRoughnessTexture",
        textureKey: "texture:metallic-roughness",
        expectedSemantic: "metallic-roughness",
        actualColorSpace: "data",
      },
      {
        field: "normalTexture",
        textureKey: "texture:normal",
        expectedSemantic: "normal",
        actualColorSpace: "linear",
      },
      {
        field: "occlusionTexture",
        textureKey: "texture:occlusion",
        expectedSemantic: "occlusion",
        actualColorSpace: "data",
      },
      {
        field: "emissiveTexture",
        textureKey: "texture:emissive",
        expectedSemantic: "emissive",
        expectedColorSpaces: ["srgb"],
      },
    ]);
    expect(json).toEqual(report);
    expect(
      JSON.parse(standardMaterialTextureReadinessReportToJson(report)),
    ).toEqual(json);
  });

  it("diagnoses mismatched StandardMaterial texture semantics and color spaces", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const sampler = createSamplerHandle("linear");
    const baseColor = createTextureHandle("wrong-base");
    const metallicRoughness = createTextureHandle("wrong-mr");
    const normal = createTextureHandle("wrong-normal");
    const occlusion = createTextureHandle("wrong-occlusion");
    const emissive = createTextureHandle("wrong-emissive");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, baseColor, "normal", "linear");
    readyTexture(registry, metallicRoughness, "base-color", "srgb");
    readyTexture(registry, normal, "emissive", "srgb");
    readyTexture(registry, occlusion, "base-color", "srgb");
    readyTexture(registry, emissive, "occlusion", "data");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture: baseColor, sampler },
        metallicRoughnessTexture: { texture: metallicRoughness, sampler },
        normalTexture: { texture: normal, sampler },
        occlusionTexture: { texture: occlusion, sampler },
        emissiveTexture: { texture: emissive, sampler },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(false);
    expect(
      report.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        materialKey: diagnostic.materialKey,
        textureKey: diagnostic.textureKey,
        field: diagnostic.field,
        expectedSemantic: diagnostic.expectedSemantic,
        actualSemantic: diagnostic.actualSemantic,
        expectedColorSpaces: diagnostic.expectedColorSpaces,
        actualColorSpace: diagnostic.actualColorSpace,
      })),
    ).toEqual([
      {
        code: "standardMaterialTexture.invalidSemantic",
        materialKey: "material:standard",
        textureKey: "texture:wrong-base",
        field: "baseColorTexture",
        expectedSemantic: "base-color",
        actualSemantic: "normal",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "linear",
      },
      {
        code: "standardMaterialTexture.invalidColorSpace",
        materialKey: "material:standard",
        textureKey: "texture:wrong-base",
        field: "baseColorTexture",
        expectedSemantic: "base-color",
        actualSemantic: "normal",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "linear",
      },
      {
        code: "standardMaterialTexture.invalidSemantic",
        materialKey: "material:standard",
        textureKey: "texture:wrong-mr",
        field: "metallicRoughnessTexture",
        expectedSemantic: "metallic-roughness",
        actualSemantic: "base-color",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "srgb",
      },
      {
        code: "standardMaterialTexture.invalidColorSpace",
        materialKey: "material:standard",
        textureKey: "texture:wrong-mr",
        field: "metallicRoughnessTexture",
        expectedSemantic: "metallic-roughness",
        actualSemantic: "base-color",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "srgb",
      },
      {
        code: "standardMaterialTexture.invalidSemantic",
        materialKey: "material:standard",
        textureKey: "texture:wrong-normal",
        field: "normalTexture",
        expectedSemantic: "normal",
        actualSemantic: "emissive",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "srgb",
      },
      {
        code: "standardMaterialTexture.invalidColorSpace",
        materialKey: "material:standard",
        textureKey: "texture:wrong-normal",
        field: "normalTexture",
        expectedSemantic: "normal",
        actualSemantic: "emissive",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "srgb",
      },
      {
        code: "standardMaterialTexture.invalidSemantic",
        materialKey: "material:standard",
        textureKey: "texture:wrong-occlusion",
        field: "occlusionTexture",
        expectedSemantic: "occlusion",
        actualSemantic: "base-color",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "srgb",
      },
      {
        code: "standardMaterialTexture.invalidColorSpace",
        materialKey: "material:standard",
        textureKey: "texture:wrong-occlusion",
        field: "occlusionTexture",
        expectedSemantic: "occlusion",
        actualSemantic: "base-color",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "srgb",
      },
      {
        code: "standardMaterialTexture.invalidSemantic",
        materialKey: "material:standard",
        textureKey: "texture:wrong-emissive",
        field: "emissiveTexture",
        expectedSemantic: "emissive",
        actualSemantic: "occlusion",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "data",
      },
      {
        code: "standardMaterialTexture.invalidColorSpace",
        materialKey: "material:standard",
        textureKey: "texture:wrong-emissive",
        field: "emissiveTexture",
        expectedSemantic: "emissive",
        actualSemantic: "occlusion",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "data",
      },
    ]);
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("diagnoses unsupported StandardMaterial texture UV sets", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("base-color-uv2");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "base-color", "srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture, sampler, texCoord: 2 },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(false);
    expect(report.slots).toMatchObject([
      {
        field: "baseColorTexture",
        textureKey: "texture:base-color-uv2",
        texCoord: 2,
        ready: false,
      },
    ]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "standardMaterialTexture.unsupportedTexCoord",
        materialKey: "material:standard",
        textureKey: "texture:base-color-uv2",
        field: "baseColorTexture",
        texCoord: 2,
        supportedTexCoords: [0, 1],
      },
    ]);
  });
});

function readyTexture(
  registry: AssetRegistry,
  handle: ReturnType<typeof createTextureHandle>,
  semantic: Parameters<typeof createTextureAsset>[0]["semantic"],
  colorSpace: Parameters<typeof createTextureAsset>[0]["colorSpace"],
): void {
  registry.register(handle);
  registry.markReady(
    handle,
    createTextureAsset({
      label: `Texture ${semantic} ${colorSpace}`,
      dimension: "2d",
      width: 1,
      height: 1,
      format: colorSpace === "srgb" ? "rgba8unorm-srgb" : "rgba8unorm",
      semantic,
      colorSpace,
      usage: ["sampled"],
    }),
  );
}
