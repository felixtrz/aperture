import { describe, expect, it } from "vitest";

import {
  createDiffuseIblTextureResourceReport,
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  diffuseIblTextureResourceReportToJson,
  diffuseIblTextureResourceReportToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("diffuse IBL texture resource", () => {
  it("creates a renderer-owned diffuse texture resource from planned IBL slots", () => {
    const created: unknown[] = [];
    const report = createDiffuseIblTextureResourceReport({
      device: deviceWithTextures(created),
      textures: textures("deferred"),
      size: 32,
    });
    const json = diffuseIblTextureResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      textureSlotCount: 2,
      diffuseSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        gpuAllocation: true,
        specularPrefiltering: false,
        shaderSampling: false,
      },
      resources: [
        {
          valid: true,
          resourceKey: "texture:studio:diffuse-irradiance:texture",
          descriptor: {
            label: "environment-map:studio:diffuse-ibl",
            size: [32, 32, 6],
            format: "rgba16float",
            usage: 6,
            mipLevelCount: 1,
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(diffuseIblTextureResourceReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|"raw"/);
    expect(created).toHaveLength(1);
  });

  it("reports unavailable devices and missing texture preparation", () => {
    const unavailable = diffuseIblTextureResourceReportToJsonValue(
      createDiffuseIblTextureResourceReport({
        device: {},
        textures: textures("ready"),
      }),
    );
    const missing = diffuseIblTextureResourceReportToJsonValue(
      createDiffuseIblTextureResourceReport({
        device: deviceWithTextures([]),
        textures: createIblTexturePreparationReport({
          descriptors: createIblResourceDescriptorReport({
            snapshot: [environment(1, "studio")],
            descriptors: [],
          }),
        }),
      }),
    );

    expect(unavailable).toMatchObject({
      ready: false,
      status: "missing",
      createdTextureCount: 0,
      reusedTextureCount: 0,
      diagnostics: [
        {
          code: "textureResource.createTextureUnavailable",
          severity: "warning",
          resourceKey: "texture:studio:diffuse-irradiance:texture",
        },
      ],
    });
    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      textureSlotCount: 2,
      diffuseSlotCount: 0,
      diagnostics: [
        {
          code: "iblTextureResource.missingTexturePreparation",
          severity: "warning",
        },
      ],
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
