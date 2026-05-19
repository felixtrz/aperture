import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblPreparationPassPlanReport,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  iblPreparationPassPlanReportToJson,
  iblPreparationPassPlanReportToJsonValue,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu";

describe("IBL preparation pass planning", () => {
  it("plans JSON-safe IBL preparation passes without submitting GPU commands", () => {
    const report = createIblPreparationPassPlanReport({
      textures: texturePreparation("deferred"),
    });
    const json = iblPreparationPassPlanReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      slotCount: 2,
      passCount: 2,
      sections: {
        texturePreparation: true,
        passPlans: true,
        passSubmission: false,
        shaderSampling: false,
      },
      passes: [
        {
          passKey: "ibl-pass:environment-map:studio:diffuse",
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1],
          kind: "diffuse",
          sourceResourceKey: "texture:studio:diffuse-irradiance",
          textureKey: "texture:studio:diffuse-irradiance:texture",
          viewKey: "texture:studio:diffuse-irradiance:view",
          samplerKey: "texture:studio:diffuse-irradiance:sampler",
          operation: "irradiance-convolution",
          submission: "deferred",
        },
        {
          passKey: "ibl-pass:environment-map:studio:specular",
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1],
          kind: "specular",
          sourceResourceKey: "texture:studio:specular-prefilter",
          textureKey: "texture:studio:specular-prefilter:texture",
          viewKey: "texture:studio:specular-prefilter:view",
          samplerKey: "texture:studio:specular-prefilter:sampler",
          operation: "specular-prefilter",
          submission: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "iblPreparationPass.submissionDeferred",
          severity: "warning",
          message:
            "IBL texture preparation passes are planned, but GPU submission is not implemented yet.",
        },
      ],
    });
    expect(JSON.parse(iblPreparationPassPlanReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUTextureView|GPURenderPass|GPUCommandEncoder|raw/,
    );
  });

  it("reports unsupported and missing texture preparation", () => {
    const unsupported = iblPreparationPassPlanReportToJsonValue(
      createIblPreparationPassPlanReport({
        textures: createIblTexturePreparationReport({
          descriptors: createIblResourceDescriptorReport({
            snapshot: [environment(1, "studio")],
            descriptors: [
              { environmentMapResourceKey: "environment-map:studio" },
            ],
          }),
        }),
      }),
    );
    const missing = iblPreparationPassPlanReportToJsonValue(
      createIblPreparationPassPlanReport({
        textures: createIblTexturePreparationReport({
          descriptors: createIblResourceDescriptorReport({
            snapshot: [environment(1, "studio")],
            descriptors: [],
          }),
        }),
      }),
    );

    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.passCount).toBe(0);
    expect(
      unsupported.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["iblPreparationPass.unsupportedSlots"]);
    expect(missing.status).toBe("missing");
    expect(missing.sections.texturePreparation).toBe(false);
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "iblPreparationPass.missingTexturePreparation",
      "iblPreparationPass.unsupportedSlots",
    ]);
  });

  it("can classify future ready submission without shader sampling", () => {
    const report = createIblPreparationPassPlanReport({
      textures: texturePreparation("ready"),
      submission: "ready",
    });
    const json = iblPreparationPassPlanReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.status).toBe("ready");
    expect(json.sections.passSubmission).toBe(true);
    expect(json.sections.shaderSampling).toBe(false);
    expect(json.diagnostics).toEqual([]);
  });
});

function texturePreparation(preparation: "deferred" | "ready" | "unsupported") {
  return createIblTexturePreparationReport({
    descriptors: createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          diffuseResourceKey: "texture:studio:diffuse-irradiance",
          specularResourceKey: "texture:studio:specular-prefilter",
        },
      ],
    }),
    preparation,
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
