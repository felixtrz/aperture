import { describe, expect, it } from "vitest";

import { createStandardMaterialSamplerFidelitySummary } from "@aperture-engine/webgpu";
import type { StandardMaterialSamplerFidelityReportJsonValue } from "@aperture-engine/render";

describe("StandardMaterial sampler fidelity summary", () => {
  it("summarizes sampler fidelity warnings by field and issue code", () => {
    const summary = createStandardMaterialSamplerFidelitySummary([
      report({
        ready: true,
        field: "baseColorTexture",
        diagnostics: [
          "standardMaterialSampler.mipmapFilterWithoutMips",
          "standardMaterialSampler.lodMaxExceedsMipRange",
        ],
      }),
      report({
        ready: true,
        field: "normalTexture",
        diagnostics: ["standardMaterialSampler.anisotropyNotReported"],
      }),
      report({
        ready: false,
        diagnostics: ["standardMaterialSampler.materialNotReady"],
      }),
    ]);

    expect(summary).toEqual({
      materialCount: 3,
      readyMaterialCount: 2,
      blockedMaterialCount: 1,
      slotCount: 2,
      warningCount: 4,
      byField: [
        { field: "baseColorTexture", slotCount: 1, warningCount: 2 },
        { field: "normalTexture", slotCount: 1, warningCount: 1 },
      ],
      byIssue: [
        {
          code: "standardMaterialSampler.anisotropyNotReported",
          count: 1,
        },
        {
          code: "standardMaterialSampler.lodMaxExceedsMipRange",
          count: 1,
        },
        {
          code: "standardMaterialSampler.materialNotReady",
          count: 1,
        },
        {
          code: "standardMaterialSampler.mipmapFilterWithoutMips",
          count: 1,
        },
      ],
      mipmapIssueCount: 1,
      lodIssueCount: 1,
      anisotropyIssueCount: 1,
    });
    expect(JSON.stringify(summary)).not.toContain("texture:");
    expect(JSON.stringify(summary)).not.toContain("sampler:");
    expect(JSON.stringify(summary)).not.toContain("GPU");
  });
});

function report(input: {
  readonly ready: boolean;
  readonly field?: StandardMaterialSamplerFidelityReportJsonValue["slots"][number]["field"];
  readonly diagnostics: readonly StandardMaterialSamplerFidelityReportJsonValue["diagnostics"][number]["code"][];
}): StandardMaterialSamplerFidelityReportJsonValue {
  return {
    ready: input.ready,
    materialKey: "material:hidden",
    materialStatus: input.ready ? "ready" : "loading",
    materialKind: "standard",
    slots:
      input.field === undefined
        ? []
        : [
            {
              field: input.field,
              textureKey: "texture:hidden",
              samplerKey: "sampler:hidden",
              mipLevelCount: 1,
              magFilter: "linear",
              minFilter: "linear",
              mipmapFilter: "linear",
              lodMinClamp: 0,
              lodMaxClamp: 32,
              maxAnisotropy: 1,
              warningCount: input.diagnostics.length,
            },
          ],
    diagnostics: input.diagnostics.map((code) => ({
      code,
      severity: "warning",
      message: code,
      materialKey: "material:hidden",
      ...(input.field === undefined ? {} : { field: input.field }),
    })),
  };
}
