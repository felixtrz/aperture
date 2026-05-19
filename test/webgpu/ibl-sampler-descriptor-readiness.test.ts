import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblSamplerDescriptorReadinessReport,
  createIblTexturePreparationReport,
  iblSamplerDescriptorReadinessReportToJson,
  iblSamplerDescriptorReadinessReportToJsonValue,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu";

describe("IBL sampler descriptor readiness", () => {
  it("plans JSON-safe sampler descriptors with deferred allocation", () => {
    const report = createIblSamplerDescriptorReadinessReport({
      textures: textures("deferred"),
    });
    const json = iblSamplerDescriptorReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      textureSlotCount: 2,
      samplerCount: 2,
      allocatedSamplerCount: 0,
      sections: {
        texturePreparation: true,
        samplerDescriptors: true,
        gpuAllocation: false,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      samplers: [
        {
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1],
          kind: "diffuse",
          sourceResourceKey: "texture:studio:diffuse-irradiance",
          samplerKey: "texture:studio:diffuse-irradiance:sampler",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          addressModeW: "clamp-to-edge",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          maxAnisotropy: 1,
          allocation: "deferred",
        },
        {
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1],
          kind: "specular",
          sourceResourceKey: "texture:studio:specular-prefilter",
          samplerKey: "texture:studio:specular-prefilter:sampler",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          addressModeW: "clamp-to-edge",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          maxAnisotropy: 1,
          allocation: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "iblSamplerDescriptor.allocationDeferred",
          severity: "warning",
          message:
            "IBL sampler descriptors are planned, but GPU sampler allocation is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(iblSamplerDescriptorReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUSampler|"raw"|callback/);
  });

  it("reports missing, unsupported, not-required, and future ready states", () => {
    const missing = iblSamplerDescriptorReadinessReportToJsonValue(
      createIblSamplerDescriptorReadinessReport({
        textures: createIblTexturePreparationReport({
          descriptors: createIblResourceDescriptorReport({
            snapshot: [environment(1, "studio")],
            descriptors: [],
          }),
        }),
      }),
    );
    const unsupported = iblSamplerDescriptorReadinessReportToJsonValue(
      createIblSamplerDescriptorReadinessReport({
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
    const notRequired = iblSamplerDescriptorReadinessReportToJsonValue(
      createIblSamplerDescriptorReadinessReport({
        textures: createIblTexturePreparationReport({
          descriptors: createIblResourceDescriptorReport({
            snapshot: [],
            descriptors: [],
          }),
        }),
      }),
    );
    const ready = iblSamplerDescriptorReadinessReportToJsonValue(
      createIblSamplerDescriptorReadinessReport({
        textures: textures("ready"),
        allocation: "ready",
      }),
    );

    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      samplerCount: 0,
      diagnostics: [
        {
          code: "iblSamplerDescriptor.missingTexturePreparation",
          severity: "warning",
        },
      ],
    });
    expect(unsupported).toMatchObject({
      ready: false,
      status: "unsupported",
      samplerCount: 0,
      diagnostics: [
        {
          code: "iblSamplerDescriptor.unsupportedTextureSlots",
          severity: "warning",
        },
      ],
    });
    expect(notRequired).toMatchObject({
      ready: true,
      status: "not-required",
      samplerCount: 0,
      diagnostics: [],
    });
    expect(ready).toMatchObject({
      ready: true,
      status: "ready",
      samplerCount: 2,
      allocatedSamplerCount: 2,
      sections: {
        gpuAllocation: true,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      diagnostics: [],
    });
  });

  it("can allocate samplers from planned texture slots before texture upload is implemented", () => {
    const report = iblSamplerDescriptorReadinessReportToJsonValue(
      createIblSamplerDescriptorReadinessReport({
        textures: textures("deferred"),
        allocation: "ready",
      }),
    );

    expect(report).toMatchObject({
      ready: true,
      status: "ready",
      textureSlotCount: 2,
      samplerCount: 2,
      allocatedSamplerCount: 2,
      sections: {
        texturePreparation: true,
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      diagnostics: [],
    });
  });
});

function textures(preparation: "deferred" | "ready" | "unsupported") {
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
