import { describe, expect, it } from "vitest";

import {
  createStandardMaterialIblShadowPipelineKeyReadinessReport,
  standardMaterialIblShadowPipelineKeyReadinessReportToJson,
  standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue,
  type StandardMaterialIblShadowBindingReadinessReport,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial IBL/shadow pipeline-key readiness", () => {
  it("proves active features from the submitted executable pipeline", () => {
    const report = createStandardMaterialIblShadowPipelineKeyReadinessReport({
      standardMaterialCount: 2,
      bindingReadiness: availableBindings(),
      bindGroupAvailable: true,
      submittedPipelineKeys: [
        "standard|shadowMap|iblDiffuse|iblSpecularBrdf|opaque|back|less|no-blend|",
      ],
    });
    const json =
      standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      status: "available",
      standardMaterialCount: 2,
      featureCount: 4,
      sections: {
        bindingReadiness: true,
        pipelineKeyMetadata: true,
        pipelineDescriptor: true,
        bindGroupLayout: true,
        shaderSampling: true,
      },
      diagnostics: [],
    });
    expect(json.features).toEqual([
      expect.objectContaining({
        feature: "ibl-diffuse-irradiance",
        pipelineKeyToken: "iblDiffuse",
        readiness: "available",
      }),
      expect.objectContaining({
        feature: "ibl-specular-prefilter",
        pipelineKeyToken: "iblSpecularBrdf",
        readiness: "available",
      }),
      expect.objectContaining({
        feature: "shadow-map",
        pipelineKeyToken: "shadowMap",
        readiness: "available",
      }),
      expect.objectContaining({
        feature: "shadow-view-projection",
        pipelineKeyToken: "shadowMap",
        readiness: "available",
      }),
    ]);
    expect(
      JSON.parse(
        standardMaterialIblShadowPipelineKeyReadinessReportToJson(report),
      ),
    ).toEqual(json);
  });

  it("reports inactive submitted features and missing binding state", () => {
    const inactive = createStandardMaterialIblShadowPipelineKeyReadinessReport({
      standardMaterialCount: 1,
      bindingReadiness: availableBindings(),
      submittedPipelineKeys: ["standard|opaque|back|less|no-blend|"],
    });
    const missing = createStandardMaterialIblShadowPipelineKeyReadinessReport({
      standardMaterialCount: 1,
      bindingReadiness: missingBindings(),
    });
    const notRequired =
      createStandardMaterialIblShadowPipelineKeyReadinessReport({
        standardMaterialCount: 0,
        bindingReadiness: availableBindings(),
      });

    expect(inactive).toMatchObject({
      ready: false,
      status: "inactive",
      sections: { shaderSampling: false },
    });
    expect(inactive.diagnostics).toHaveLength(4);
    expect(
      inactive.diagnostics.every(
        (diagnostic) =>
          diagnostic.code ===
          "standardMaterialIblShadowPipelineKey.featureInactive",
      ),
    ).toBe(true);
    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
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
      diagnostics: [],
    });
  });
});

function availableBindings(): StandardMaterialIblShadowBindingReadinessReport {
  return {
    ready: true,
    status: "available",
    standardMaterialCount: 2,
    slotCount: 4,
    sections: { iblPassPlanning: true, shadowPlanning: true },
    slots: [
      {
        bindingKey: "standard-material:ibl:diffuse",
        resourceKey: "texture:studio:diffuse:view",
        kind: "ibl-diffuse",
        source: "ibl",
        readiness: "available",
      },
      {
        bindingKey: "standard-material:ibl:specular",
        resourceKey: "texture:studio:specular:view",
        kind: "ibl-specular",
        source: "ibl",
        readiness: "available",
      },
      {
        bindingKey: "standard-material:shadow:7:view-projection",
        resourceKey: "shadow-pass:7:view-projection",
        kind: "shadow-view-projection",
        source: "shadow",
        readiness: "available",
      },
      {
        bindingKey: "standard-material:shadow:7:map",
        resourceKey: "shadow-pass:7",
        kind: "shadow-map",
        source: "shadow",
        readiness: "available",
      },
    ],
    diagnostics: [],
  };
}

function missingBindings(): StandardMaterialIblShadowBindingReadinessReport {
  return {
    ready: false,
    status: "missing",
    standardMaterialCount: 1,
    slotCount: 0,
    sections: { iblPassPlanning: false, shadowPlanning: false },
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
