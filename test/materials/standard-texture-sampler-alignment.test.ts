import { describe, expect, it } from "vitest";
import {
  createStandardMaterialTextureSamplerAlignmentSummary,
  standardMaterialTextureSamplerAlignmentSummaryToJsonValue,
  type StandardMaterialSamplerFidelityReportJsonValue,
  type StandardMaterialTextureReadinessReportJsonValue,
} from "@aperture-engine/render";

describe("StandardMaterial texture/sampler alignment summary", () => {
  it("keeps blocking texture readiness separate from sampler fidelity warnings", () => {
    const summary = createStandardMaterialTextureSamplerAlignmentSummary({
      textureReadiness: textureReadinessReport(),
      samplerFidelity: samplerFidelityReport(),
    });

    expect(summary).toEqual({
      materialKey: "material:standard",
      textureReady: false,
      samplerFidelityReady: true,
      blockingTextureDiagnosticCount: 2,
      samplerWarningCount: 2,
      byField: [
        {
          field: "baseColorTexture",
          textureSlotReady: false,
          samplerWarningCount: 2,
        },
        {
          field: "metallicRoughnessTexture",
          textureSlotReady: null,
          samplerWarningCount: 0,
        },
        {
          field: "normalTexture",
          textureSlotReady: true,
          samplerWarningCount: 0,
        },
        {
          field: "occlusionTexture",
          textureSlotReady: null,
          samplerWarningCount: 0,
        },
        {
          field: "emissiveTexture",
          textureSlotReady: null,
          samplerWarningCount: 0,
        },
      ],
    });
    expect(
      standardMaterialTextureSamplerAlignmentSummaryToJsonValue(summary),
    ).toEqual(summary);
    expect(JSON.stringify(summary)).not.toContain("texture:");
    expect(JSON.stringify(summary)).not.toContain("sampler:");
    expect(JSON.stringify(summary)).not.toContain("GPU");
  });
});

function textureReadinessReport(): StandardMaterialTextureReadinessReportJsonValue {
  return {
    ready: false,
    materialKey: "material:standard",
    materialStatus: "ready",
    materialKind: "standard",
    slots: [
      {
        field: "normalTexture",
        textureKey: "texture:normal",
        expectedSemantic: "normal",
        actualSemantic: "normal",
        expectedColorSpaces: ["linear", "data"],
        actualColorSpace: "linear",
        actualFormat: "rgba8unorm",
        texCoord: 0,
        ready: true,
      },
      {
        field: "baseColorTexture",
        textureKey: "texture:base",
        expectedSemantic: "base-color",
        actualSemantic: "base-color",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "srgb",
        actualFormat: "rgba8unorm-srgb",
        texCoord: 0,
        ready: false,
      },
    ],
    diagnostics: [
      {
        code: "standardMaterialTexture.missingSamplerHandle",
        severity: "warning",
        materialKey: "material:standard",
        field: "baseColorTexture",
        textureKey: "texture:base",
        message: "Missing sampler.",
      },
      {
        code: "standardMaterialTexture.unsupportedTextureTransform",
        severity: "warning",
        materialKey: "material:standard",
        field: "baseColorTexture",
        textureKey: "texture:base",
        samplerKey: "sampler:base",
        message: "Unsupported transform.",
      },
    ],
  };
}

function samplerFidelityReport(): StandardMaterialSamplerFidelityReportJsonValue {
  return {
    ready: true,
    materialKey: "material:standard",
    materialStatus: "ready",
    materialKind: "standard",
    slots: [
      {
        field: "baseColorTexture",
        textureKey: "texture:base",
        samplerKey: "sampler:base",
        mipLevelCount: 1,
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        lodMinClamp: 0,
        lodMaxClamp: 32,
        maxAnisotropy: 1,
        warningCount: 2,
      },
    ],
    diagnostics: [
      {
        code: "standardMaterialSampler.mipmapFilterWithoutMips",
        severity: "warning",
        materialKey: "material:standard",
        field: "baseColorTexture",
        textureKey: "texture:base",
        samplerKey: "sampler:base",
        message: "Mip filter without mips.",
      },
      {
        code: "standardMaterialSampler.lodMaxExceedsMipRange",
        severity: "warning",
        materialKey: "material:standard",
        field: "baseColorTexture",
        textureKey: "texture:base",
        samplerKey: "sampler:base",
        message: "LOD exceeds range.",
      },
    ],
  };
}
