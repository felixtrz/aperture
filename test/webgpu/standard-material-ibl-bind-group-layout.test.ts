import { describe, expect, it } from "vitest";

import {
  createStandardMaterialIblBindGroupLayoutPlan,
  createStandardMaterialIblBindGroupLayoutReadinessReport,
  standardMaterialIblBindGroupLayoutReadinessReportToJson,
  standardMaterialIblBindGroupLayoutReadinessReportToJsonValue,
  validateStandardMaterialIblBindGroupLayout,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial IBL bind group layout", () => {
  it("plans JSON-safe group 4 texture and sampler layout metadata", () => {
    const report = createStandardMaterialIblBindGroupLayoutReadinessReport({
      standardMaterialCount: 2,
    });
    const json =
      standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      standardMaterialCount: 2,
      group: 4,
      bindingCount: 3,
      sections: {
        layoutMetadata: true,
        layoutDescriptor: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      layout: {
        group: 4,
        label: "standard/ibl/group-4",
        entries: [
          {
            binding: 0,
            label: "diffuseIrradianceTexture",
            resource: "texture",
          },
          {
            binding: 1,
            label: "specularPrefilterTexture",
            resource: "texture",
          },
          { binding: 2, label: "iblSampler", resource: "sampler" },
        ],
        metadata: {
          group: 4,
          name: "standardMaterialIbl",
          layoutKey: "standard/ibl/group-4",
          bindings: [
            {
              binding: 0,
              name: "diffuseIrradianceTexture",
              resourceKind: "texture-view",
              visibility: ["fragment"],
              required: true,
            },
            {
              binding: 1,
              name: "specularPrefilterTexture",
              resourceKind: "texture-view",
              visibility: ["fragment"],
              required: true,
            },
            {
              binding: 2,
              name: "iblSampler",
              resourceKind: "sampler",
              visibility: ["fragment"],
              required: true,
            },
          ],
        },
      },
      diagnostics: [
        {
          code: "standardMaterialIblBindGroupLayout.bindGroupResourceDeferred",
          severity: "warning",
          message:
            "StandardMaterial IBL bind-group layout metadata is planned, but bind group resource creation is deferred.",
        },
        {
          code: "standardMaterialIblBindGroupLayout.shaderSamplingDeferred",
          severity: "warning",
          message:
            "StandardMaterial IBL bind-group layout metadata is planned, but WGSL shader sampling is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(
        standardMaterialIblBindGroupLayoutReadinessReportToJson(report),
      ),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPU|raw/);
  });

  it("validates required binding metadata", () => {
    const plan = createStandardMaterialIblBindGroupLayoutPlan();

    expect(plan.valid).toBe(true);
    expect(
      validateStandardMaterialIblBindGroupLayout({
        group: 4,
        entries: plan.layout.entries.slice(0, 2),
        metadata: plan.layout.metadata,
      }),
    ).toEqual([
      {
        code: "standardMaterialIblBindGroupLayout.missingBinding",
        binding: 2,
        message:
          "Standard material IBL bind group layout is missing required binding 2.",
      },
    ]);
    expect(
      validateStandardMaterialIblBindGroupLayout({
        group: 3,
        entries: [
          {
            binding: 0,
            label: "diffuseIrradianceTexture",
            resource: "texture",
          },
          {
            binding: 1,
            label: "specularPrefilterTexture",
            resource: "sampler",
          },
          { binding: 2, label: "iblSampler", resource: "sampler" },
        ],
        metadata: plan.layout.metadata,
      }),
    ).toEqual([
      {
        code: "standardMaterialIblBindGroupLayout.invalidGroup",
        message:
          "Standard material IBL resources must use bind group 4; received group 3.",
      },
      {
        code: "standardMaterialIblBindGroupLayout.resourceKindMismatch",
        binding: 1,
        message:
          "Standard material IBL binding 1 must be 'texture', not 'sampler'.",
      },
    ]);
  });
});
