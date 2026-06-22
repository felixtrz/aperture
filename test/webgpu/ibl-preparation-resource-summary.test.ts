import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblPreparationPassPlanReport,
  createIblPreparationResourceSummaryReport,
  createIblPreparationResourceSummaryScratch,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  iblPreparationResourceSummaryReportToJson,
  iblPreparationResourceSummaryReportToJsonValue,
  writeIblPreparationResourceSummaryReport,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu/test-support";

describe("IBL preparation resource summary", () => {
  it("summarizes descriptor, texture, and pass readiness without GPU handles", () => {
    const report = createIblPreparationResourceSummaryReport({
      descriptors: descriptors(),
      textures: textures("deferred"),
      passPlan: passPlan("deferred", "deferred"),
    });
    const json = iblPreparationResourceSummaryReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      counts: {
        environmentMaps: 1,
        descriptors: 1,
        textureSlots: 2,
        plannedTextures: 2,
        plannedViews: 2,
        plannedSamplers: 2,
        preparationPasses: 2,
      },
      sections: {
        iblDescriptors: true,
        textureDescriptors: true,
        textureUpload: false,
        prefilterPassPlans: true,
        passSubmission: false,
        shaderSampling: false,
      },
      resourceKeys: {
        environmentMaps: ["environment-map:studio"],
        textures: [
          "texture:studio:diffuse-irradiance:texture",
          "texture:studio:specular-prefilter:texture",
        ],
        views: [
          "texture:studio:diffuse-irradiance:view",
          "texture:studio:specular-prefilter:view",
        ],
        samplers: [
          "texture:studio:diffuse-irradiance:sampler",
          "texture:studio:specular-prefilter:sampler",
        ],
        passes: [
          "ibl-pass:environment-map:studio:diffuse",
          "ibl-pass:environment-map:studio:specular",
        ],
      },
      diagnostics: [
        {
          code: "iblPreparationResourceSummary.textureUploadDeferred",
          severity: "warning",
          message:
            "IBL texture descriptors are planned, but GPU texture upload is deferred.",
        },
        {
          code: "iblPreparationResourceSummary.passSubmissionDeferred",
          severity: "warning",
          message:
            "IBL preparation passes are planned, but GPU pass submission is deferred.",
        },
        {
          code: "iblPreparationResourceSummary.shaderSamplingDeferred",
          severity: "warning",
          message:
            "IBL preparation resource status is data-only; StandardMaterial shader sampling remains deferred.",
        },
      ],
    });
    expect(
      JSON.parse(iblPreparationResourceSummaryReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUTextureView|GPURenderPass|GPUCommandEncoder|raw/,
    );
  });

  it("reports not-required, missing, unsupported, and future ready states", () => {
    const notRequired = summary({
      descriptorReport: createIblResourceDescriptorReport({
        snapshot: [],
        descriptors: [],
      }),
    });
    const missing = summary({
      descriptorReport: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
        descriptors: [],
      }),
    });
    const unsupported = summary({
      descriptorReport: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
        descriptors: [{ environmentMapResourceKey: "environment-map:studio" }],
      }),
    });
    const ready = summary({
      texturePreparation: "ready",
      passSubmission: "ready",
    });

    expect(notRequired).toMatchObject({
      ready: true,
      status: "not-required",
      counts: {
        environmentMaps: 0,
        descriptors: 0,
        textureSlots: 0,
        preparationPasses: 0,
      },
      diagnostics: [],
    });
    expect(missing.status).toBe("missing");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "iblPreparationResourceSummary.missingDescriptors",
      "iblPreparationResourceSummary.missingTexturePreparation",
      "iblPreparationResourceSummary.missingPassPlan",
      "iblPreparationResourceSummary.shaderSamplingDeferred",
    ]);
    expect(unsupported.status).toBe("unsupported");
    expect(
      unsupported.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "iblPreparationResourceSummary.unsupportedTexturePreparation",
      "iblPreparationResourceSummary.unsupportedPassPlan",
      "iblPreparationResourceSummary.shaderSamplingDeferred",
    ]);
    expect(ready).toMatchObject({
      ready: true,
      status: "ready",
      sections: {
        textureUpload: true,
        passSubmission: true,
        shaderSampling: false,
      },
      diagnostics: [
        {
          code: "iblPreparationResourceSummary.shaderSamplingDeferred",
          severity: "warning",
        },
      ],
    });
  });

  it("refills caller-owned scratch arrays", () => {
    const scratch = createIblPreparationResourceSummaryScratch();
    const input = summaryInput({
      texturePreparation: "ready",
      passSubmission: "ready",
    });
    const first = writeIblPreparationResourceSummaryReport(input, scratch);
    const firstTextures = first.resourceKeys.textures;
    const firstDiagnostics = first.diagnostics;
    const second = writeIblPreparationResourceSummaryReport(input, scratch);

    expect(second.resourceKeys.textures).toBe(firstTextures);
    expect(second.diagnostics).toBe(firstDiagnostics);
    expect(second).toMatchObject({
      ready: true,
      status: "ready",
      counts: {
        plannedTextures: 2,
        plannedSamplers: 2,
        preparationPasses: 2,
      },
    });
  });
});

function summary(input: {
  readonly descriptorReport?: ReturnType<typeof descriptors>;
  readonly texturePreparation?: "deferred" | "ready" | "unsupported";
  readonly passSubmission?: "deferred" | "ready" | "unsupported";
}) {
  return iblPreparationResourceSummaryReportToJsonValue(
    createIblPreparationResourceSummaryReport(summaryInput(input)),
  );
}

function summaryInput(input: {
  readonly descriptorReport?: ReturnType<typeof descriptors>;
  readonly texturePreparation?: "deferred" | "ready" | "unsupported";
  readonly passSubmission?: "deferred" | "ready" | "unsupported";
}) {
  const descriptorReport = input.descriptorReport ?? descriptors();
  const textureReport = createIblTexturePreparationReport({
    descriptors: descriptorReport,
    preparation: input.texturePreparation ?? "deferred",
  });

  return {
    descriptors: descriptorReport,
    textures: textureReport,
    passPlan: createIblPreparationPassPlanReport({
      textures: textureReport,
      submission: input.passSubmission ?? "deferred",
    }),
  };
}

function passPlan(
  texturePreparation: "deferred" | "ready" | "unsupported",
  passSubmission: "deferred" | "ready" | "unsupported",
) {
  return createIblPreparationPassPlanReport({
    textures: textures(texturePreparation),
    submission: passSubmission,
  });
}

function textures(preparation: "deferred" | "ready" | "unsupported") {
  return createIblTexturePreparationReport({
    descriptors: descriptors(),
    preparation,
  });
}

function descriptors() {
  return createIblResourceDescriptorReport({
    snapshot: [environment(2, "studio"), environment(1, "studio")],
    descriptors: [
      {
        environmentMapResourceKey: "environment-map:studio",
        diffuseResourceKey: "texture:studio:diffuse-irradiance",
        specularResourceKey: "texture:studio:specular-prefilter",
      },
    ],
  });
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
