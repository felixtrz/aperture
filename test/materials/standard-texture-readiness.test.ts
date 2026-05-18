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

  it("accepts TEXCOORD_1 for every rendered StandardMaterial texture field", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const sampler = createSamplerHandle("linear");
    const baseColor = createTextureHandle("base-color-uv1");
    const metallicRoughness = createTextureHandle("metallic-roughness-uv1");
    const normal = createTextureHandle("normal-uv1");
    const occlusion = createTextureHandle("occlusion-uv1");
    const emissive = createTextureHandle("emissive-uv1");

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
        baseColorTexture: { texture: baseColor, sampler, texCoord: 1 },
        metallicRoughnessTexture: {
          texture: metallicRoughness,
          sampler,
          texCoord: 1,
        },
        normalTexture: { texture: normal, sampler, texCoord: 1 },
        occlusionTexture: { texture: occlusion, sampler, texCoord: 1 },
        emissiveTexture: { texture: emissive, sampler, texCoord: 1 },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(
      report.slots.map((slot) => ({
        field: slot.field,
        textureKey: slot.textureKey,
        texCoord: slot.texCoord,
        ready: slot.ready,
      })),
    ).toEqual([
      {
        field: "baseColorTexture",
        textureKey: "texture:base-color-uv1",
        texCoord: 1,
        ready: true,
      },
      {
        field: "metallicRoughnessTexture",
        textureKey: "texture:metallic-roughness-uv1",
        texCoord: 1,
        ready: true,
      },
      {
        field: "normalTexture",
        textureKey: "texture:normal-uv1",
        texCoord: 1,
        ready: true,
      },
      {
        field: "occlusionTexture",
        textureKey: "texture:occlusion-uv1",
        texCoord: 1,
        ready: true,
      },
      {
        field: "emissiveTexture",
        textureKey: "texture:emissive-uv1",
        texCoord: 1,
        ready: true,
      },
    ]);
    expect(
      JSON.parse(standardMaterialTextureReadinessReportToJson(report)),
    ).toEqual(standardMaterialTextureReadinessReportToJsonValue(report));
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

  it("diagnoses StandardMaterial texture format and color-space mismatches", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const sampler = createSamplerHandle("linear");
    const baseColor = createTextureHandle("base-color-linear-format");
    const normal = createTextureHandle("normal-srgb-format");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, baseColor, "base-color", "srgb", "rgba8unorm");
    readyTexture(registry, normal, "normal", "data", "rgba8unorm-srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture: baseColor, sampler },
        normalTexture: { texture: normal, sampler },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(false);
    expect(
      report.slots.map((slot) => ({
        field: slot.field,
        textureKey: slot.textureKey,
        actualColorSpace: slot.actualColorSpace,
        actualFormat: slot.actualFormat,
        ready: slot.ready,
      })),
    ).toEqual([
      {
        field: "baseColorTexture",
        textureKey: "texture:base-color-linear-format",
        actualColorSpace: "srgb",
        actualFormat: "rgba8unorm",
        ready: false,
      },
      {
        field: "normalTexture",
        textureKey: "texture:normal-srgb-format",
        actualColorSpace: "data",
        actualFormat: "rgba8unorm-srgb",
        ready: false,
      },
    ]);
    expect(
      report.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        field: diagnostic.field,
        textureKey: diagnostic.textureKey,
        expectedColorSpaces: diagnostic.expectedColorSpaces,
        actualColorSpace: diagnostic.actualColorSpace,
        expectedFormatSrgb: diagnostic.expectedFormatSrgb,
        actualFormat: diagnostic.actualFormat,
      })),
    ).toEqual([
      {
        code: "standardMaterialTexture.invalidColorSpaceFormat",
        field: "baseColorTexture",
        textureKey: "texture:base-color-linear-format",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "srgb",
        expectedFormatSrgb: true,
        actualFormat: "rgba8unorm",
      },
      {
        code: "standardMaterialTexture.invalidColorSpaceFormat",
        field: "normalTexture",
        textureKey: "texture:normal-srgb-format",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "data",
        expectedFormatSrgb: false,
        actualFormat: "rgba8unorm-srgb",
      },
    ]);
    expect(
      JSON.parse(standardMaterialTextureReadinessReportToJson(report)),
    ).toEqual(standardMaterialTextureReadinessReportToJsonValue(report));
  });

  it("diagnoses StandardMaterial texture and sampler dependency states by channel", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const failedBase = createTextureHandle("failed-base");
    const loadingBaseSampler = createSamplerHandle("loading-base-sampler");
    const missingMr = createTextureHandle("missing-mr");
    const missingMrSampler = createSamplerHandle("missing-mr-sampler");
    const normal = createTextureHandle("normal-ready");
    const failedOcclusionSampler = createSamplerHandle("failed-occlusion");
    const loadingEmissive = createTextureHandle("loading-emissive");
    const readyEmissiveSampler = createSamplerHandle("ready-emissive");

    registry.register(failedBase);
    registry.markFailed(failedBase, [
      { code: "texture.failed", message: "base failed", severity: "error" },
    ]);
    registry.register(loadingBaseSampler);
    registry.markLoading(loadingBaseSampler);
    readyTexture(registry, normal, "normal", "linear");
    registry.register(failedOcclusionSampler);
    registry.markFailed(failedOcclusionSampler, [
      {
        code: "sampler.failed",
        message: "occlusion failed",
        severity: "error",
      },
    ]);
    registry.register(loadingEmissive);
    registry.markLoading(loadingEmissive);
    registry.register(readyEmissiveSampler);
    registry.markReady(readyEmissiveSampler, createSamplerAsset());
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: {
          texture: failedBase,
          sampler: loadingBaseSampler,
        },
        metallicRoughnessTexture: {
          texture: missingMr,
          sampler: missingMrSampler,
        },
        normalTexture: {
          texture: normal,
          sampler: null,
        },
        occlusionTexture: {
          texture: null,
          sampler: failedOcclusionSampler,
        },
        emissiveTexture: {
          texture: loadingEmissive,
          sampler: readyEmissiveSampler,
        },
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
        field: diagnostic.field,
        dependencyKind: diagnostic.dependencyKind,
        textureKey: diagnostic.textureKey,
        samplerKey: diagnostic.samplerKey,
        status: diagnostic.status,
      })),
    ).toEqual([
      {
        code: "standardMaterialTexture.textureNotReady",
        field: "baseColorTexture",
        dependencyKind: "texture",
        textureKey: "texture:failed-base",
        samplerKey: "sampler:loading-base-sampler",
        status: "failed",
      },
      {
        code: "standardMaterialTexture.samplerNotReady",
        field: "baseColorTexture",
        dependencyKind: "sampler",
        textureKey: "texture:failed-base",
        samplerKey: "sampler:loading-base-sampler",
        status: "loading",
      },
      {
        code: "standardMaterialTexture.textureNotReady",
        field: "metallicRoughnessTexture",
        dependencyKind: "texture",
        textureKey: "texture:missing-mr",
        samplerKey: "sampler:missing-mr-sampler",
        status: "missing",
      },
      {
        code: "standardMaterialTexture.samplerNotReady",
        field: "metallicRoughnessTexture",
        dependencyKind: "sampler",
        textureKey: "texture:missing-mr",
        samplerKey: "sampler:missing-mr-sampler",
        status: "missing",
      },
      {
        code: "standardMaterialTexture.missingSamplerHandle",
        field: "normalTexture",
        dependencyKind: "sampler",
        textureKey: "texture:normal-ready",
        samplerKey: undefined,
        status: "missing",
      },
      {
        code: "standardMaterialTexture.missingTextureHandle",
        field: "occlusionTexture",
        dependencyKind: "texture",
        textureKey: undefined,
        samplerKey: "sampler:failed-occlusion",
        status: "missing",
      },
      {
        code: "standardMaterialTexture.samplerNotReady",
        field: "occlusionTexture",
        dependencyKind: "sampler",
        textureKey: undefined,
        samplerKey: "sampler:failed-occlusion",
        status: "failed",
      },
      {
        code: "standardMaterialTexture.textureNotReady",
        field: "emissiveTexture",
        dependencyKind: "texture",
        textureKey: "texture:loading-emissive",
        samplerKey: "sampler:ready-emissive",
        status: "loading",
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
        baseColorTexture: {
          texture,
          sampler,
          texCoord: 2,
          transform: { offset: [0.25, 0.5] },
        },
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
        code: "standardMaterialTexture.unsupportedTextureTransform",
        materialKey: "material:standard",
        textureKey: "texture:base-color-uv2",
        field: "baseColorTexture",
        textureTransform: { offset: [0.25, 0.5] },
      },
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

  it("accepts metallic-roughness texture transforms on TEXCOORD_0", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("metallic-roughness-transform");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "metallic-roughness", "linear");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        metallicRoughnessTexture: {
          texture,
          sampler,
          transform: {
            offset: [0.25, 0.5],
            scale: [0.5, 0.5],
            rotation: 0.125,
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });
    const json = standardMaterialTextureReadinessReportToJsonValue(report);

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "metallicRoughnessTexture",
        textureKey: "texture:metallic-roughness-transform",
        texCoord: 0,
        ready: true,
      }),
    ]);
    expect(
      JSON.parse(standardMaterialTextureReadinessReportToJson(report)),
    ).toEqual(json);
  });

  it("accepts normal texture transforms on TEXCOORD_0", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("normal-transform");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "normal", "linear");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        normalTexture: {
          texture,
          sampler,
          transform: {
            offset: [0.25, 0.5],
            scale: [0.5, 0.5],
            rotation: 0.125,
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "normalTexture",
        textureKey: "texture:normal-transform",
        texCoord: 0,
        ready: true,
      }),
    ]);
  });

  it("accepts occlusion texture transforms on TEXCOORD_0", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("occlusion-transform");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "occlusion", "linear");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        occlusionTexture: {
          texture,
          sampler,
          transform: {
            offset: [0.25, 0.5],
            scale: [0.5, 0.5],
            rotation: 0.125,
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "occlusionTexture",
        textureKey: "texture:occlusion-transform",
        texCoord: 0,
        ready: true,
      }),
    ]);
  });

  it("accepts emissive texture transforms on TEXCOORD_0", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("emissive-transform");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "emissive", "srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        emissiveTexture: {
          texture,
          sampler,
          transform: {
            offset: [0.25, 0.5],
            scale: [0.5, 0.5],
            rotation: 0.125,
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "emissiveTexture",
        textureKey: "texture:emissive-transform",
        texCoord: 0,
        ready: true,
      }),
    ]);
  });

  it("accepts base-color offset and scale transforms on TEXCOORD_0", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("base-color-transform");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "base-color", "srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: {
          texture,
          sampler,
          texCoord: 0,
          transform: {
            offset: [0.25, 0.5],
            scale: [0.5, 0.5],
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "baseColorTexture",
        textureKey: "texture:base-color-transform",
        texCoord: 0,
        ready: true,
      }),
    ]);
  });

  it("accepts base-color rotation transforms on TEXCOORD_0", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("base-color-transform-rotation");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "base-color", "srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: {
          texture,
          sampler,
          texCoord: 0,
          transform: {
            offset: [0.5, 0.5],
            rotation: Math.PI / 2,
            scale: [1, 1],
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "baseColorTexture",
        textureKey: "texture:base-color-transform-rotation",
        texCoord: 0,
        ready: true,
      }),
    ]);
  });

  it("accepts transformed TEXCOORD_1 base-color bindings", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const texture = createTextureHandle("base-color-transform-uv1");
    const sampler = createSamplerHandle("linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    readyTexture(registry, texture, "base-color", "srgb");
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: {
          texture,
          sampler,
          texCoord: 1,
          transform: {
            offset: [0.25, 0.5],
            scale: [0.5, 0.5],
          },
        },
      }),
    );

    const report = createStandardMaterialTextureReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "baseColorTexture",
        textureKey: "texture:base-color-transform-uv1",
        texCoord: 1,
        ready: true,
      }),
    ]);
  });
});

function readyTexture(
  registry: AssetRegistry,
  handle: ReturnType<typeof createTextureHandle>,
  semantic: Parameters<typeof createTextureAsset>[0]["semantic"],
  colorSpace: Parameters<typeof createTextureAsset>[0]["colorSpace"],
  format: Parameters<typeof createTextureAsset>[0]["format"] = colorSpace ===
  "srgb"
    ? "rgba8unorm-srgb"
    : "rgba8unorm",
): void {
  registry.register(handle);
  registry.markReady(
    handle,
    createTextureAsset({
      label: `Texture ${semantic} ${colorSpace}`,
      dimension: "2d",
      width: 1,
      height: 1,
      format,
      semantic,
      colorSpace,
      usage: ["sampled"],
    }),
  );
}
