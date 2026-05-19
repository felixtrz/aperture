import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblSamplerDescriptorReadinessReport,
  createIblSamplerResourceReport,
  createIblTexturePreparationReport,
  iblSamplerResourceReportToJson,
  iblSamplerResourceReportToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("IBL sampler resource", () => {
  it("creates renderer-owned sampler resources from ready IBL sampler descriptors", () => {
    const created: unknown[] = [];
    const report = createIblSamplerResourceReport({
      device: deviceWithSamplers(created),
      samplers: samplers("ready"),
    });
    const json = iblSamplerResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      samplerDescriptorCount: 2,
      createdSamplerCount: 2,
      reusedSamplerCount: 0,
      sections: {
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      resources: [
        {
          valid: true,
          resourceKey: "texture:studio:diffuse-irradiance:sampler",
          descriptor: {
            label: "environment-map:studio:diffuse:ibl-sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            lodMinClamp: 0,
            lodMaxClamp: 32,
            maxAnisotropy: 1,
          },
        },
        {
          valid: true,
          resourceKey: "texture:studio:specular-prefilter:sampler",
          descriptor: {
            label: "environment-map:studio:specular:ibl-sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            lodMinClamp: 0,
            lodMaxClamp: 32,
            maxAnisotropy: 1,
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(iblSamplerResourceReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUSampler|"raw"|callback/);
    expect(created).toHaveLength(2);
  });

  it("reports unavailable devices and missing sampler descriptors", () => {
    const unavailable = iblSamplerResourceReportToJsonValue(
      createIblSamplerResourceReport({
        device: {},
        samplers: samplers("ready"),
      }),
    );
    const missing = iblSamplerResourceReportToJsonValue(
      createIblSamplerResourceReport({
        device: deviceWithSamplers([]),
        samplers: samplers("deferred"),
      }),
    );

    expect(unavailable).toMatchObject({
      ready: false,
      status: "missing",
      createdSamplerCount: 0,
      reusedSamplerCount: 0,
      diagnostics: [
        {
          code: "samplerResource.createSamplerUnavailable",
          severity: "warning",
          resourceKey: "texture:studio:diffuse-irradiance:sampler",
        },
        {
          code: "samplerResource.createSamplerUnavailable",
          severity: "warning",
          resourceKey: "texture:studio:specular-prefilter:sampler",
        },
      ],
    });
    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      samplerDescriptorCount: 2,
      diagnostics: [
        {
          code: "iblSamplerResource.missingSamplerDescriptors",
          severity: "warning",
        },
      ],
    });
  });
});

function samplers(allocation: "ready" | "deferred" | "unsupported") {
  return createIblSamplerDescriptorReadinessReport({
    textures: createIblTexturePreparationReport({
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
      preparation: allocation === "unsupported" ? "unsupported" : "ready",
    }),
    allocation,
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

function deviceWithSamplers(created: unknown[]): TextureGpuDeviceLike {
  return {
    createSampler: (descriptor) => {
      created.push(descriptor);

      return { descriptor };
    },
  };
}
