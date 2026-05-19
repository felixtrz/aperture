import { describe, expect, it } from "vitest";

import {
  createStandardMaterialIblShadowPipelineKeyReadinessReport,
  standardMaterialIblShadowPipelineKeyReadinessReportToJson,
  standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue,
  type StandardMaterialIblShadowBindingReadinessReport,
} from "@aperture-engine/webgpu";

describe("StandardMaterial IBL/shadow pipeline-key readiness", () => {
  it("reports deferred pipeline-key features without changing pipeline descriptors", () => {
    const report = createStandardMaterialIblShadowPipelineKeyReadinessReport({
      standardMaterialCount: 2,
      bindingReadiness: bindingReadiness("deferred"),
    });
    const json =
      standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      standardMaterialCount: 2,
      featureCount: 4,
      sections: {
        bindingReadiness: true,
        pipelineKeyMetadata: true,
        pipelineDescriptor: false,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      features: [
        {
          feature: "ibl-diffuse-irradiance",
          pipelineKeyToken: "iblDiffuseIrradiance",
          source: "ibl",
          requiredBySlotCount: 1,
          readiness: "deferred",
        },
        {
          feature: "ibl-specular-prefilter",
          pipelineKeyToken: "iblSpecularPrefilter",
          source: "ibl",
          requiredBySlotCount: 1,
          readiness: "deferred",
        },
        {
          feature: "shadow-map",
          pipelineKeyToken: "shadowMap",
          source: "shadow",
          requiredBySlotCount: 1,
          readiness: "deferred",
        },
        {
          feature: "shadow-view-projection",
          pipelineKeyToken: "shadowViewProjection",
          source: "shadow",
          requiredBySlotCount: 1,
          readiness: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "standardMaterialIblShadowPipelineKey.deferredFeature",
          severity: "warning",
          feature: "ibl-diffuse-irradiance",
          message:
            "iblDiffuseIrradiance is a deferred StandardMaterial pipeline-key feature for future IBL/shadow sampling.",
        },
        {
          code: "standardMaterialIblShadowPipelineKey.deferredFeature",
          severity: "warning",
          feature: "ibl-specular-prefilter",
          message:
            "iblSpecularPrefilter is a deferred StandardMaterial pipeline-key feature for future IBL/shadow sampling.",
        },
        {
          code: "standardMaterialIblShadowPipelineKey.deferredFeature",
          severity: "warning",
          feature: "shadow-map",
          message:
            "shadowMap is a deferred StandardMaterial pipeline-key feature for future IBL/shadow sampling.",
        },
        {
          code: "standardMaterialIblShadowPipelineKey.deferredFeature",
          severity: "warning",
          feature: "shadow-view-projection",
          message:
            "shadowViewProjection is a deferred StandardMaterial pipeline-key feature for future IBL/shadow sampling.",
        },
        {
          code: "standardMaterialIblShadowPipelineKey.shaderSamplingDeferred",
          severity: "warning",
          message:
            "StandardMaterial IBL/shadow pipeline-key metadata is planned, but WGSL, bind-group layouts, and shader sampling remain deferred.",
        },
      ],
    });
    expect(
      JSON.parse(
        standardMaterialIblShadowPipelineKeyReadinessReportToJson(report),
      ),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUShaderModule|GPUBindGroupLayout|GPURenderPipeline|"raw"/,
    );
  });

  it("reports missing binding readiness and no-material as not required", () => {
    const missing =
      standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(
        createStandardMaterialIblShadowPipelineKeyReadinessReport({
          standardMaterialCount: 1,
          bindingReadiness: bindingReadiness("missing"),
        }),
      );
    const notRequired =
      standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(
        createStandardMaterialIblShadowPipelineKeyReadinessReport({
          standardMaterialCount: 0,
          bindingReadiness: bindingReadiness("deferred"),
        }),
      );

    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      featureCount: 0,
      sections: {
        bindingReadiness: false,
        pipelineKeyMetadata: false,
        pipelineDescriptor: false,
      },
      diagnostics: [
        {
          code: "standardMaterialIblShadowPipelineKey.missingBindingReadiness",
          severity: "warning",
        },
      ],
    });
    expect(notRequired).toMatchObject({
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      featureCount: 0,
      diagnostics: [],
    });
  });
});

function bindingReadiness(
  status: "deferred" | "missing",
): StandardMaterialIblShadowBindingReadinessReport {
  if (status === "missing") {
    return {
      ready: false,
      status: "missing",
      standardMaterialCount: 1,
      slotCount: 0,
      sections: {
        iblPassPlanning: false,
        shadowPlanning: false,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialIblShadowBinding.missingIblPlan",
          severity: "warning",
          message: "missing",
        },
      ],
    };
  }

  return {
    ready: false,
    status: "deferred",
    standardMaterialCount: 2,
    slotCount: 4,
    sections: {
      iblPassPlanning: true,
      shadowPlanning: true,
      bindGroupLayout: false,
      shaderSampling: false,
    },
    slots: [
      {
        bindingKey: "standard-material:ibl:diffuse",
        resourceKey: "texture:studio:diffuse:view",
        kind: "ibl-diffuse",
        source: "ibl",
        readiness: "deferred",
      },
      {
        bindingKey: "standard-material:ibl:specular",
        resourceKey: "texture:studio:specular:view",
        kind: "ibl-specular",
        source: "ibl",
        readiness: "deferred",
      },
      {
        bindingKey: "standard-material:shadow:7:view-projection",
        resourceKey: "shadow-pass:7:light:11:view-projection",
        kind: "shadow-view-projection",
        source: "shadow",
        readiness: "deferred",
      },
      {
        bindingKey: "standard-material:shadow:7:map",
        resourceKey: "shadow-pass:7:light:11",
        kind: "shadow-map",
        source: "shadow",
        readiness: "deferred",
      },
    ],
    diagnostics: [],
  };
}
