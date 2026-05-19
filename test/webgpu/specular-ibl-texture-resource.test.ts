import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  createSpecularIblTextureResourceReport,
  specularIblTextureResourceReportToJson,
  specularIblTextureResourceReportToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("specular IBL texture resource", () => {
  it("creates a renderer-owned specular texture resource from planned IBL slots", () => {
    const created: unknown[] = [];
    const report = createSpecularIblTextureResourceReport({
      device: deviceWithTextures(created),
      textures: textures("deferred"),
      size: 32,
    });
    const json = specularIblTextureResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      textureSlotCount: 2,
      specularSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        specularTextureResource: true,
        gpuAllocation: true,
        prefiltering: false,
        bindGroupResource: false,
        shaderSampling: false,
      },
      resources: [
        {
          valid: true,
          resourceKey: "texture:studio:specular-prefilter:texture",
          descriptor: {
            label: "environment-map:studio:specular-ibl",
            size: [32, 32, 6],
            format: "rgba16float",
            usage: 22,
            mipLevelCount: 6,
          },
        },
      ],
      diagnostics: [
        {
          code: "iblTextureResource.specularPrefilteringDeferred",
          severity: "warning",
          message:
            "Specular IBL texture resources are allocated, but prefilter pass execution remains deferred.",
        },
      ],
    });
    expect(JSON.parse(specularIblTextureResourceReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|"raw"/);
    expect(created).toHaveLength(1);
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

function deviceWithTextures(created: unknown[]): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => {
      created.push(descriptor);

      return {
        createView: () => ({ descriptor }),
      };
    },
  };
}
