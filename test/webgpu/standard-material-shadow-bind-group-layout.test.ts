import { describe, expect, it } from "vitest";

import {
  createStandardMaterialShadowBindGroupLayoutPlan,
  createStandardMaterialShadowBindGroupLayoutReadinessReport,
  standardMaterialShadowBindGroupLayoutReadinessReportToJson,
  standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue,
  validateStandardMaterialShadowBindGroupLayout,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial shadow bind group layout", () => {
  it("plans JSON-safe group 5 shadow matrix, depth texture, and sampler metadata", () => {
    const report = createStandardMaterialShadowBindGroupLayoutReadinessReport({
      standardMaterialCount: 2,
    });
    const json =
      standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: false,
      status: "deferred",
      standardMaterialCount: 2,
      group: 5,
      bindingCount: 3,
      sections: {
        layoutMetadata: true,
        layoutDescriptor: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      layout: {
        group: 5,
        label: "standard/shadow/group-5",
        entries: [
          {
            binding: 0,
            label: "directionalShadowMatrices",
            resource: "read-only-storage-buffer",
          },
          {
            binding: 1,
            label: "directionalShadowMap",
            resource: "texture",
          },
          {
            binding: 2,
            label: "directionalShadowSampler",
            resource: "sampler",
          },
        ],
        metadata: {
          group: 5,
          name: "standardMaterialShadow",
          layoutKey: "standard/shadow/group-5",
        },
      },
      diagnostics: [
        {
          code: "standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred",
          severity: "warning",
        },
        {
          code: "standardMaterialShadowBindGroupLayout.shaderSamplingDeferred",
          severity: "warning",
        },
      ],
    });
    expect(
      JSON.parse(
        standardMaterialShadowBindGroupLayoutReadinessReportToJson(report),
      ),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUBuffer|raw/);
  });

  it("validates required shadow binding metadata", () => {
    const plan = createStandardMaterialShadowBindGroupLayoutPlan();

    expect(plan.valid).toBe(true);
    expect(
      validateStandardMaterialShadowBindGroupLayout({
        group: 5,
        entries: plan.layout.entries.slice(0, 2),
        metadata: plan.layout.metadata,
      }),
    ).toEqual([
      {
        code: "standardMaterialShadowBindGroupLayout.missingBinding",
        binding: 2,
        message:
          "Standard material shadow bind group layout is missing required binding 2.",
      },
    ]);
    expect(
      validateStandardMaterialShadowBindGroupLayout({
        group: 4,
        entries: [
          {
            binding: 0,
            label: "directionalShadowMatrices",
            resource: "texture",
          },
          {
            binding: 1,
            label: "directionalShadowMap",
            resource: "texture",
          },
          {
            binding: 2,
            label: "directionalShadowSampler",
            resource: "sampler",
          },
        ],
        metadata: plan.layout.metadata,
      }),
    ).toEqual([
      {
        code: "standardMaterialShadowBindGroupLayout.invalidGroup",
        message:
          "Standard material shadow resources must use bind group 5; received group 4.",
      },
      {
        code: "standardMaterialShadowBindGroupLayout.resourceKindMismatch",
        binding: 0,
        message:
          "Standard material shadow binding 0 must be 'read-only-storage-buffer', not 'texture'.",
      },
    ]);
  });
});
