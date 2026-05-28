import { describe, expect, it } from "vitest";

import {
  createDiffuseIblResourceSummaryReport,
  createDiffuseIblTextureResourceReport,
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblSamplerDescriptorReadinessReport,
  createIblSamplerResourceReport,
  createIblTexturePreparationReport,
  diffuseIblResourceSummaryReportToJson,
  diffuseIblResourceSummaryReportToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("diffuse IBL resource summary", () => {
  it("summarizes live diffuse texture and sampler resources with deferred shader work", () => {
    const texturesReport = textures();
    const textureResource = createDiffuseIblTextureResourceReport({
      device: deviceWithResources(),
      textures: texturesReport,
      size: 32,
    });
    const samplerResource = createIblSamplerResourceReport({
      device: deviceWithResources(),
      samplers: createIblSamplerDescriptorReadinessReport({
        textures: texturesReport,
        allocation: "ready",
      }),
    });
    const report = createDiffuseIblResourceSummaryReport({
      textures: texturesReport,
      diffuseTextureResource: textureResource,
      samplers: samplerResource,
    });
    const json = diffuseIblResourceSummaryReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      counts: {
        textureSlots: 2,
        diffuseTextureResources: 1,
        samplerResources: 2,
        deferredSpecularSlots: 1,
      },
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        samplerResources: true,
        specularPrefiltering: false,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      resourceKeys: {
        diffuseTextures: ["texture:studio:diffuse-irradiance:texture"],
        samplers: [
          "texture:studio:diffuse-irradiance:sampler",
          "texture:studio:specular-prefilter:sampler",
        ],
        deferredSpecularTextures: ["texture:studio:specular-prefilter:texture"],
      },
      diagnostics: [
        {
          code: "diffuseIblResourceSummary.specularPrefilteringDeferred",
          severity: "warning",
          message:
            "Diffuse IBL resources are available, but specular prefiltering remains deferred.",
        },
        {
          code: "diffuseIblResourceSummary.bindGroupLayoutDeferred",
          severity: "warning",
          message:
            "Diffuse IBL resources are available, but StandardMaterial bind-group layout changes remain deferred.",
        },
        {
          code: "diffuseIblResourceSummary.shaderSamplingDeferred",
          severity: "warning",
          message:
            "Diffuse IBL resources are available, but StandardMaterial shader sampling remains deferred.",
        },
      ],
    });
    expect(JSON.parse(diffuseIblResourceSummaryReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUSampler|"raw"/);
  });
});

function textures() {
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

function deviceWithResources(): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => ({
      createView: () => ({ descriptor }),
    }),
    createSampler: (descriptor) => ({ descriptor }),
  };
}
