import { describe, expect, it } from "vitest";

import {
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  createStandardMaterialShadowReadinessReport,
  standardMaterialShadowReadinessReportToJson,
  standardMaterialShadowReadinessReportToJsonValue,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu";

describe("StandardMaterial shadow readiness", () => {
  it("reports deferred shadow pass submission distinctly from shader sampling", () => {
    const report = createStandardMaterialShadowReadinessReport({
      standardMaterialCount: 2,
      shadowPassPlan: passPlan("deferred"),
    });
    const json = standardMaterialShadowReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: false,
      status: "deferred",
      standardMaterialCount: 2,
      shadowRequestCount: 1,
      passCount: 1,
      sections: {
        shadowRequests: true,
        shadowTextureResources: true,
        shadowPassPlan: true,
        passSubmission: false,
        shaderSampling: false,
      },
      diagnostics: [
        {
          code: "standardMaterialShadow.passSubmissionDeferred",
          severity: "warning",
          passPlanDiagnostics: [
            {
              code: "shadowPassPlan.submissionDeferred",
              severity: "warning",
            },
          ],
        },
        {
          code: "standardMaterialShadow.shaderSamplingDeferred",
          severity: "warning",
          passPlanDiagnostics: [],
        },
      ],
    });
    expect(
      JSON.parse(standardMaterialShadowReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUTextureView|GPURenderPass|GPUCommandEncoder|callback|raw/,
    );
  });

  it("reports missing shadow pass prerequisites", () => {
    const report = createStandardMaterialShadowReadinessReport({
      standardMaterialCount: 1,
      shadowPassPlan: createShadowPassPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        textures: createShadowTextureResourceReport({
          descriptors: createShadowMapDescriptorReport({
            shadowRequests: [shadowRequest(7, 11)],
            descriptors: [],
          }),
        }),
      }),
    });
    const json = standardMaterialShadowReadinessReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("missing");
    expect(json.sections).toMatchObject({
      shadowTextureResources: false,
      shadowPassPlan: false,
      passSubmission: false,
      shaderSampling: false,
    });
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialShadow.missingPassPlan",
      "standardMaterialShadow.shaderSamplingDeferred",
    ]);
  });

  it("reports unsupported and available pass states", () => {
    const unsupported = standardMaterialShadowReadinessReportToJsonValue(
      createStandardMaterialShadowReadinessReport({
        standardMaterialCount: 1,
        shadowPassPlan: passPlan("unsupported"),
      }),
    );
    const available = standardMaterialShadowReadinessReportToJsonValue(
      createStandardMaterialShadowReadinessReport({
        standardMaterialCount: 1,
        shadowPassPlan: passPlan("ready"),
      }),
    );

    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.ready).toBe(false);
    expect(
      unsupported.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "standardMaterialShadow.unsupportedPassSubmission",
      "standardMaterialShadow.shaderSamplingDeferred",
    ]);
    expect(available.status).toBe("available");
    expect(available.ready).toBe(true);
    expect(available.sections.passSubmission).toBe(true);
    expect(available.sections.shaderSampling).toBe(false);
    expect(available.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialShadow.shaderSamplingDeferred",
    ]);
  });

  it("treats no StandardMaterial or no shadow requests as not required", () => {
    const report = createStandardMaterialShadowReadinessReport({
      standardMaterialCount: 0,
      shadowPassPlan: createShadowPassPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        textures: createShadowTextureResourceReport({
          descriptors: createShadowMapDescriptorReport({
            shadowRequests: [shadowRequest(7, 11)],
            descriptors: [
              {
                shadowId: 7,
                lightId: 11,
                mapSize: 1024,
                depthBias: 0.001,
              },
            ],
          }),
        }),
      }),
    });

    expect(
      standardMaterialShadowReadinessReportToJsonValue(report),
    ).toMatchObject({
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      sections: {
        passSubmission: true,
        shaderSampling: false,
      },
      diagnostics: [],
    });
  });
});

function passPlan(submission: "deferred" | "ready" | "unsupported") {
  return createShadowPassPlanReport({
    shadowRequests: [shadowRequest(7, 11)],
    textures: createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest(7, 11)],
        descriptors: [
          {
            shadowId: 7,
            lightId: 11,
            mapSize: 1024,
            depthBias: 0.001,
          },
        ],
      }),
    }),
    submission,
  });
}

function shadowRequest(shadowId: number, lightId: number): ShadowRequestPacket {
  return {
    shadowId,
    lightId,
    casterLayerMask: 1,
    receiverLayerMask: 2,
  };
}
