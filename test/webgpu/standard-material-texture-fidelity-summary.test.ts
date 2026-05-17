import { describe, expect, it } from "vitest";

import type {
  StandardMaterialTextureField,
  StandardMaterialTextureReadinessDiagnostic,
  StandardMaterialTextureReadinessReportJsonValue,
  StandardMaterialTextureReadinessSlot,
} from "@aperture-engine/render";
import { createStandardMaterialTextureFidelitySummary } from "@aperture-engine/webgpu";

describe("StandardMaterial texture fidelity summary", () => {
  it("summarizes empty StandardMaterial texture readiness reports", () => {
    expect(createStandardMaterialTextureFidelitySummary([])).toEqual({
      materialCount: 0,
      readyMaterialCount: 0,
      blockedMaterialCount: 0,
      slotCount: 0,
      readySlotCount: 0,
      blockedSlotCount: 0,
      byField: [],
      byIssue: [],
      samplerIssueCount: 0,
      colorSpaceIssueCount: 0,
      semanticIssueCount: 0,
      texCoordIssueCount: 0,
      transformIssueCount: 0,
    });
  });

  it("summarizes ready StandardMaterial texture fields in deterministic order", () => {
    const summary = createStandardMaterialTextureFidelitySummary([
      report({
        ready: true,
        slots: [
          slot("emissiveTexture", "texture:emissive", true),
          slot("baseColorTexture", "texture:base-color", true),
          slot("metallicRoughnessTexture", "texture:mr", true),
        ],
      }),
    ]);

    expect(summary).toEqual({
      materialCount: 1,
      readyMaterialCount: 1,
      blockedMaterialCount: 0,
      slotCount: 3,
      readySlotCount: 3,
      blockedSlotCount: 0,
      byField: [
        {
          field: "baseColorTexture",
          slotCount: 1,
          readySlotCount: 1,
          blockedSlotCount: 0,
        },
        {
          field: "metallicRoughnessTexture",
          slotCount: 1,
          readySlotCount: 1,
          blockedSlotCount: 0,
        },
        {
          field: "emissiveTexture",
          slotCount: 1,
          readySlotCount: 1,
          blockedSlotCount: 0,
        },
      ],
      byIssue: [],
      samplerIssueCount: 0,
      colorSpaceIssueCount: 0,
      semanticIssueCount: 0,
      texCoordIssueCount: 0,
      transformIssueCount: 0,
    });
  });

  it("summarizes sampler, color-space, semantic, UV, and transform issues without handles", () => {
    const summary = createStandardMaterialTextureFidelitySummary([
      report({
        ready: false,
        slots: [
          slot("baseColorTexture", "texture:bad-base", false),
          slot("normalTexture", "texture:normal", true),
          slot("emissiveTexture", "texture:emissive", true),
        ],
        diagnostics: [
          diagnostic(
            "standardMaterialTexture.invalidColorSpace",
            "baseColorTexture",
          ),
          diagnostic(
            "standardMaterialTexture.invalidSemantic",
            "baseColorTexture",
          ),
          diagnostic(
            "standardMaterialTexture.missingSamplerHandle",
            "normalTexture",
          ),
          diagnostic(
            "standardMaterialTexture.samplerNotReady",
            "emissiveTexture",
          ),
          diagnostic(
            "standardMaterialTexture.unsupportedTexCoord",
            "occlusionTexture",
          ),
          diagnostic(
            "standardMaterialTexture.unsupportedTextureTransform",
            "metallicRoughnessTexture",
          ),
        ],
      }),
    ]);

    expect(summary).toEqual({
      materialCount: 1,
      readyMaterialCount: 0,
      blockedMaterialCount: 1,
      slotCount: 5,
      readySlotCount: 0,
      blockedSlotCount: 5,
      byField: [
        {
          field: "baseColorTexture",
          slotCount: 1,
          readySlotCount: 0,
          blockedSlotCount: 1,
        },
        {
          field: "metallicRoughnessTexture",
          slotCount: 1,
          readySlotCount: 0,
          blockedSlotCount: 1,
        },
        {
          field: "normalTexture",
          slotCount: 1,
          readySlotCount: 0,
          blockedSlotCount: 1,
        },
        {
          field: "occlusionTexture",
          slotCount: 1,
          readySlotCount: 0,
          blockedSlotCount: 1,
        },
        {
          field: "emissiveTexture",
          slotCount: 1,
          readySlotCount: 0,
          blockedSlotCount: 1,
        },
      ],
      byIssue: [
        { code: "standardMaterialTexture.invalidColorSpace", count: 1 },
        { code: "standardMaterialTexture.invalidSemantic", count: 1 },
        { code: "standardMaterialTexture.missingSamplerHandle", count: 1 },
        { code: "standardMaterialTexture.samplerNotReady", count: 1 },
        { code: "standardMaterialTexture.unsupportedTexCoord", count: 1 },
        {
          code: "standardMaterialTexture.unsupportedTextureTransform",
          count: 1,
        },
      ],
      samplerIssueCount: 2,
      colorSpaceIssueCount: 1,
      semanticIssueCount: 1,
      texCoordIssueCount: 1,
      transformIssueCount: 1,
    });

    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("material:bad-standard");
    expect(serialized).not.toContain("texture:bad-base");
    expect(serialized).not.toContain("sampler:bad-standard");
    expect(serialized).not.toContain("gpu-texture-handle");
  });
});

function report(input: {
  readonly ready: boolean;
  readonly slots: readonly StandardMaterialTextureReadinessSlot[];
  readonly diagnostics?: readonly StandardMaterialTextureReadinessDiagnostic[];
}): StandardMaterialTextureReadinessReportJsonValue {
  return {
    ready: input.ready,
    materialKey: input.ready
      ? "material:ready-standard"
      : "material:bad-standard",
    materialStatus: "ready",
    materialKind: "standard",
    slots: input.slots,
    diagnostics: input.diagnostics ?? [],
  };
}

function slot(
  field: StandardMaterialTextureField,
  textureKey: string,
  ready: boolean,
): StandardMaterialTextureReadinessSlot {
  return {
    field,
    textureKey,
    expectedSemantic:
      field === "baseColorTexture" ? "base-color" : "metallic-roughness",
    actualSemantic:
      field === "baseColorTexture" ? "base-color" : "metallic-roughness",
    expectedColorSpaces:
      field === "baseColorTexture" ? ["srgb"] : ["linear", "data"],
    actualColorSpace: field === "baseColorTexture" ? "srgb" : "data",
    texCoord: 0,
    ready,
  };
}

function diagnostic(
  code: StandardMaterialTextureReadinessDiagnostic["code"],
  field: StandardMaterialTextureField,
): StandardMaterialTextureReadinessDiagnostic {
  return {
    code,
    severity: "warning",
    materialKey: "material:bad-standard",
    field,
    textureKey: `texture:${field}`,
    samplerKey: `sampler:${field}`,
    message: `${field} produced a texture fidelity issue.`,
  };
}
