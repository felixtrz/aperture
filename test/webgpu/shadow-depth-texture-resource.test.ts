import { describe, expect, it } from "vitest";

import {
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowTextureResourceReport,
  resolveShadowDepthTextureAttachmentView,
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
          layerCount: 1,
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

  it("creates array texture views and per-cascade attachment views for CSM", () => {
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const request = { ...shadowRequest(7, 11), cascadeCount: 3 };
    const report = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures, createdViews),
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [request],
          descriptors: [
            {
              shadowId: 7,
              lightId: 11,
              mapSize: 1024,
              depthBias: 0.001,
            },
          ],
        }),
      }),
    });
    const json = shadowDepthTextureResourceReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      resources: [
        {
          layerCount: 3,
          viewDimension: "2d-array",
          attachmentViewKeys: [
            "shadow-map:7:light:11:cascade-0:view",
            "shadow-map:7:light:11:cascade-1:view",
            "shadow-map:7:light:11:cascade-2:view",
          ],
          descriptor: { size: [1024, 1024, 3] },
        },
      ],
    });
    expect(createdViews[0]).toEqual({
      dimension: "2d-array",
      arrayLayerCount: 3,
    });
    expect(createdViews.slice(1)).toEqual([
      {
        dimension: "2d",
        baseArrayLayer: 0,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
      {
        dimension: "2d",
        baseArrayLayer: 1,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
      {
        dimension: "2d",
        baseArrayLayer: 2,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
    ]);
    expect(
      resolveShadowDepthTextureAttachmentView(report, {
        shadowId: 7,
        lightId: 11,
        viewKey: "shadow-map:7:light:11:cascade-1:view",
      }),
    ).toEqual({
      descriptor: {
        dimension: "2d",
        baseArrayLayer: 1,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
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

function deviceWithTextures(
  created: unknown[],
  createdViews: unknown[] = [],
): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => {
      created.push(descriptor);

      return {
        createView: (viewDescriptor) => {
          createdViews.push(viewDescriptor);
          return { descriptor: viewDescriptor };
        },
      };
    },
  };
}
