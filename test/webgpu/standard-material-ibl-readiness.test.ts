import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createStandardMaterialIblReadinessReport,
  standardMaterialIblReadinessReportToJson,
  standardMaterialIblReadinessReportToJsonValue,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial IBL readiness", () => {
  it("reports available descriptors while keeping shader sampling deferred", () => {
    const report = createStandardMaterialIblReadinessReport({
      standardMaterialCount: 2,
      iblDescriptors: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
        descriptors: [
          {
            environmentMapResourceKey: "environment-map:studio",
            diffuseResourceKey: "texture:studio:diffuse",
            specularResourceKey: "texture:studio:specular",
          },
        ],
      }),
    });
    const json = standardMaterialIblReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      status: "available",
      standardMaterialCount: 2,
      descriptorCount: 1,
      sections: {
        iblDescriptors: true,
        diffuseIrradiance: true,
        specularPrefilter: true,
        shaderSampling: false,
      },
      diagnostics: [
        {
          code: "standardMaterialIbl.shaderSamplingDeferred",
          severity: "warning",
          descriptorDiagnostics: [],
        },
      ],
    });
    expect(
      JSON.parse(standardMaterialIblReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPU|handle|callback/);
  });

  it("reports unsupported descriptor slots distinctly from missing descriptors", () => {
    const report = createStandardMaterialIblReadinessReport({
      standardMaterialCount: 1,
      iblDescriptors: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
        descriptors: [{ environmentMapResourceKey: "environment-map:studio" }],
      }),
    });
    const json = standardMaterialIblReadinessReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("unsupported");
    expect(json.sections).toMatchObject({
      iblDescriptors: true,
      diffuseIrradiance: false,
      specularPrefilter: false,
      shaderSampling: false,
    });
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialIbl.unsupportedSlots",
      "standardMaterialIbl.shaderSamplingDeferred",
    ]);
  });

  it("reports missing descriptors", () => {
    const report = createStandardMaterialIblReadinessReport({
      standardMaterialCount: 1,
      iblDescriptors: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
        descriptors: [],
      }),
    });
    const json = standardMaterialIblReadinessReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("missing");
    expect(json.sections.iblDescriptors).toBe(false);
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialIbl.missingDescriptors",
      "standardMaterialIbl.unsupportedSlots",
      "standardMaterialIbl.shaderSamplingDeferred",
    ]);
  });

  it("treats no StandardMaterial or no environment as not required", () => {
    const report = createStandardMaterialIblReadinessReport({
      standardMaterialCount: 0,
      iblDescriptors: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
      }),
    });

    expect(standardMaterialIblReadinessReportToJsonValue(report)).toMatchObject(
      {
        ready: true,
        status: "not-required",
        standardMaterialCount: 0,
        sections: {
          diffuseIrradiance: null,
          specularPrefilter: null,
          shaderSampling: false,
        },
        diagnostics: [],
      },
    );
  });
});

function environment(
  environmentId: number,
  handleId: string,
): EnvironmentPacket {
  return {
    environmentId,
    handle: createEnvironmentMapHandle(handleId),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}
