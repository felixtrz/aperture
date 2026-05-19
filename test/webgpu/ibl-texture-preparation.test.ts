import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  iblTexturePreparationReportToJson,
  iblTexturePreparationReportToJsonValue,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu";

describe("IBL texture preparation", () => {
  it("plans JSON-safe diffuse and specular texture resources as deferred", () => {
    const report = createIblTexturePreparationReport({
      descriptors: createIblResourceDescriptorReport({
        snapshot: [environment(2, "studio"), environment(1, "studio")],
        descriptors: [
          {
            environmentMapResourceKey: "environment-map:studio",
            diffuseResourceKey: "texture:studio:diffuse-irradiance",
            specularResourceKey: "texture:studio:specular-prefilter",
          },
        ],
      }),
    });
    const json = iblTexturePreparationReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      descriptorCount: 1,
      slotCount: 2,
      preparedSlotCount: 0,
      sections: {
        iblDescriptors: true,
        texturePreparation: true,
        textureUpload: false,
        prefiltering: false,
        shaderSampling: false,
      },
      slots: [
        {
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1, 2],
          kind: "diffuse",
          sourceResourceKey: "texture:studio:diffuse-irradiance",
          placeholder: null,
          textureKey: "texture:studio:diffuse-irradiance:texture",
          viewKey: "texture:studio:diffuse-irradiance:view",
          samplerKey: "texture:studio:diffuse-irradiance:sampler",
          dimension: "cube",
          format: "rgba16float",
          usageIntent: "texture-binding",
          preparation: "deferred",
        },
        {
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1, 2],
          kind: "specular",
          sourceResourceKey: "texture:studio:specular-prefilter",
          placeholder: null,
          textureKey: "texture:studio:specular-prefilter:texture",
          viewKey: "texture:studio:specular-prefilter:view",
          samplerKey: "texture:studio:specular-prefilter:sampler",
          dimension: "cube",
          format: "rgba16float",
          usageIntent: "texture-binding",
          preparation: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "iblTexturePreparation.preparationDeferred",
          severity: "warning",
          descriptorDiagnostics: [],
          message:
            "IBL texture descriptors are planned, but texture upload and prefiltering are not implemented yet.",
        },
      ],
    });
    expect(JSON.parse(iblTexturePreparationReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|raw/);
  });

  it("reports unsupported descriptor slots before texture preparation", () => {
    const report = createIblTexturePreparationReport({
      descriptors: createIblResourceDescriptorReport({
        snapshot: [environment(1, "studio")],
        descriptors: [{ environmentMapResourceKey: "environment-map:studio" }],
      }),
    });
    const json = iblTexturePreparationReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("unsupported");
    expect(json.preparedSlotCount).toBe(0);
    expect(json.sections).toEqual({
      iblDescriptors: true,
      texturePreparation: false,
      textureUpload: false,
      prefiltering: false,
      shaderSampling: false,
    });
    expect(json.slots.map((slot) => slot.preparation)).toEqual([
      "unsupported",
      "unsupported",
    ]);
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "iblTexturePreparation.unsupportedSlots",
    ]);
  });

  it("reports missing descriptors and can classify ready preparation", () => {
    const missing = iblTexturePreparationReportToJsonValue(
      createIblTexturePreparationReport({
        descriptors: createIblResourceDescriptorReport({
          snapshot: [environment(1, "studio")],
          descriptors: [],
        }),
      }),
    );
    const ready = iblTexturePreparationReportToJsonValue(
      createIblTexturePreparationReport({
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
        preparation: "ready",
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.sections.iblDescriptors).toBe(false);
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "iblTexturePreparation.missingDescriptors",
      "iblTexturePreparation.unsupportedSlots",
    ]);
    expect(ready.status).toBe("ready");
    expect(ready.ready).toBe(true);
    expect(ready.preparedSlotCount).toBe(2);
    expect(ready.sections.textureUpload).toBe(true);
    expect(ready.sections.prefiltering).toBe(true);
    expect(ready.sections.shaderSampling).toBe(false);
    expect(ready.diagnostics).toEqual([]);
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
