import { describe, expect, it } from "vitest";

import {
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowTextureResourceReport,
  shadowDepthTextureResourceReportToJson,
  shadowDepthTextureResourceReportToJsonValue,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("shadow depth texture resource", () => {
  it("creates renderer-owned depth texture resources from planned shadow texture descriptors", () => {
    const created: unknown[] = [];
    const report = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(created),
      textures: textures(),
    });
    const json = shadowDepthTextureResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      textureDescriptorCount: 1,
      createdTextureCount: 1,
      sections: {
        textureDescriptors: true,
        depthTextureResource: true,
        gpuAllocation: true,
        matrixUpload: false,
        passSubmission: false,
        shaderSampling: false,
      },
      resources: [
        {
          valid: true,
          shadowId: 7,
          lightId: 11,
          resourceKey: "shadow-map:7:light:11",
          textureKey: "shadow-map:7:light:11:texture",
          viewKey: "shadow-map:7:light:11:view",
          faceCount: 1,
          viewDimension: "2d",
          attachmentViewKeys: ["shadow-map:7:light:11:view"],
          descriptor: {
            label: "shadow-map:7:light:11:depth",
            size: [1024, 1024, 1],
            format: "depth24plus",
            usage: 20,
            mipLevelCount: 1,
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(shadowDepthTextureResourceReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|raw/);
    expect(created).toEqual([
      {
        label: "shadow-map:7:light:11:depth",
        size: [1024, 1024, 1],
        format: "depth24plus",
        usage: 20,
        mipLevelCount: 1,
      },
    ]);
  });

  it("reports unavailable devices and missing texture descriptors", () => {
    const unavailable = shadowDepthTextureResourceReportToJsonValue(
      createShadowDepthTextureResourceReport({
        device: {},
        textures: textures(),
      }),
    );
    const missing = shadowDepthTextureResourceReportToJsonValue(
      createShadowDepthTextureResourceReport({
        device: deviceWithTextures([]),
        textures: createShadowTextureResourceReport({
          descriptors: createShadowMapDescriptorReport({
            shadowRequests: [shadowRequest(7, 11)],
            descriptors: [],
          }),
        }),
      }),
    );

    expect(unavailable).toMatchObject({
      ready: false,
      status: "missing",
      createdTextureCount: 0,
      diagnostics: [
        {
          code: "textureResource.createTextureUnavailable",
          severity: "warning",
          resourceKey: "shadow-map:7:light:11:texture",
        },
      ],
    });
    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      textureDescriptorCount: 0,
      diagnostics: [
        {
          code: "shadowDepthTextureResource.missingTextureDescriptors",
          severity: "warning",
        },
      ],
    });
  });
});

function textures() {
  return createShadowTextureResourceReport({
    descriptors: createShadowMapDescriptorReport({
      shadowRequests: [shadowRequest(7, 11)],
      descriptors: [
        {
          shadowId: 7,
          lightId: 11,
          mapSize: 1024,
          depthBias: 0.001,
        },
      ],
    }),
  });
}

function shadowRequest(shadowId: number, lightId: number): ShadowRequestPacket {
  return {
    shadowId,
    lightId,
    casterLayerMask: 1,
    receiverLayerMask: 2,
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
