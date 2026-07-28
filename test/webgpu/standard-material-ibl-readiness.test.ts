import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  createStandardMaterialIblReadinessReport,
  standardMaterialIblReadinessReportToJson,
  standardMaterialIblReadinessReportToJsonValue,
  type EnvironmentPacket,
  type StandardMaterialIblBindGroupResourceReport,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial IBL readiness", () => {
  it("reports the submitted diffuse+specular pipeline as active", () => {
    const descriptors = readyDescriptors();
    const report = createStandardMaterialIblReadinessReport({
      standardMaterialCount: 2,
      iblDescriptors: descriptors,
      texturePreparation: createIblTexturePreparationReport({
        descriptors,
        preparation: "ready",
      }),
      bindGroupResource: availableBindGroup(),
      submittedPipelineKeys: [
        "standard|iblDiffuse|iblSpecularBrdf|opaque|back|less|no-blend|",
      ],
    });
    const json = standardMaterialIblReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      status: "pipeline-active",
      standardMaterialCount: 2,
      descriptorCount: 1,
      submittedStandardPipelineCount: 1,
      activeIblPipelineCount: 1,
      sections: {
        environmentRequested: true,
        environmentSource: true,
        iblDescriptors: true,
        diffuseIrradiance: true,
        specularPrefilter: true,
        bindGroupResource: true,
        pipelineActive: true,
        shaderSampling: true,
      },
      diagnostics: [],
    });
    expect(
      JSON.parse(standardMaterialIblReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPU|handle|callback|raw/);
  });

  it("distinguishes source missing and preparation failure", () => {
    const missingDescriptors = createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [],
    });
    const unsupportedDescriptors = createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [{ environmentMapResourceKey: "environment-map:studio" }],
    });
    const sourceMissing = standardMaterialIblReadinessReportToJsonValue(
      createStandardMaterialIblReadinessReport({
        standardMaterialCount: 1,
        iblDescriptors: missingDescriptors,
      }),
    );
    const preparationFailed = standardMaterialIblReadinessReportToJsonValue(
      createStandardMaterialIblReadinessReport({
        standardMaterialCount: 1,
        iblDescriptors: unsupportedDescriptors,
        texturePreparation: createIblTexturePreparationReport({
          descriptors: unsupportedDescriptors,
          preparation: "unsupported",
        }),
      }),
    );

    expect(sourceMissing).toMatchObject({
      ready: false,
      status: "source-missing",
      sections: { environmentRequested: true, environmentSource: false },
      diagnostics: [{ code: "standardMaterialIbl.missingDescriptors" }],
    });
    expect(preparationFailed).toMatchObject({
      ready: false,
      status: "preparation-failed",
      diagnostics: [{ code: "standardMaterialIbl.preparationFailed" }],
    });
  });

  it("distinguishes diffuse readiness from diffuse+specular readiness", () => {
    const both = readyDescriptors();
    const diffuseOnly = createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          diffuseResourceKey: "texture:studio:diffuse",
        },
      ],
    });

    expect(
      createStandardMaterialIblReadinessReport({
        standardMaterialCount: 1,
        iblDescriptors: diffuseOnly,
      }).status,
    ).toBe("diffuse-ready");
    expect(
      createStandardMaterialIblReadinessReport({
        standardMaterialCount: 1,
        iblDescriptors: both,
      }).status,
    ).toBe("diffuse-specular-ready");
  });

  it("reports a submitted-pipeline/resource mismatch", () => {
    const descriptors = readyDescriptors();
    const report = createStandardMaterialIblReadinessReport({
      standardMaterialCount: 1,
      iblDescriptors: descriptors,
      texturePreparation: createIblTexturePreparationReport({
        descriptors,
        preparation: "ready",
      }),
      bindGroupResource: {
        ...availableBindGroup(),
        ready: false,
        status: "missing",
        resource: null,
      },
      submittedPipelineKeys: [
        "standard|iblDiffuse|iblSpecularBrdf|opaque|back|less|no-blend|",
      ],
    });

    expect(report).toMatchObject({
      ready: false,
      status: "diffuse-specular-ready",
      sections: { pipelineActive: false, shaderSampling: false },
      diagnostics: [{ code: "standardMaterialIbl.pipelineResourceMismatch" }],
    });
  });

  it("distinguishes no material from no environment requested", () => {
    const environmentDescriptors = readyDescriptors();
    const noEnvironmentDescriptors = createIblResourceDescriptorReport({
      snapshot: [],
      descriptors: [],
    });

    expect(
      createStandardMaterialIblReadinessReport({
        standardMaterialCount: 0,
        iblDescriptors: environmentDescriptors,
      }),
    ).toMatchObject({ status: "not-required", ready: true });
    expect(
      createStandardMaterialIblReadinessReport({
        standardMaterialCount: 1,
        iblDescriptors: noEnvironmentDescriptors,
      }),
    ).toMatchObject({
      status: "not-requested",
      ready: true,
      sections: { environmentRequested: false, shaderSampling: false },
    });
  });
});

function readyDescriptors() {
  return createIblResourceDescriptorReport({
    snapshot: [environment(1, "studio")],
    descriptors: [
      {
        environmentMapResourceKey: "environment-map:studio",
        diffuseResourceKey: "texture:studio:diffuse",
        specularResourceKey: "texture:studio:specular",
      },
    ],
  });
}

function availableBindGroup(): StandardMaterialIblBindGroupResourceReport {
  return {
    ready: true,
    status: "available",
    standardMaterialCount: 1,
    group: 4,
    createdBindGroupCount: 1,
    reusedBindGroupCount: 0,
    sections: {
      descriptorPlan: true,
      layoutResource: true,
      textureResources: true,
      samplerResource: true,
      bindGroupResource: true,
    },
    resource: {
      group: 4,
      resourceKey: "standard/ibl/group-4",
      layoutKey: "standard/ibl/layout",
      bindGroup: {},
      entryResourceKeys: ["diffuse", "specular", "sampler"],
    },
    diagnostics: [],
  };
}

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
