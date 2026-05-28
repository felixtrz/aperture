import { describe, expect, it } from "vitest";

import {
  createShadowDepthResourceSummaryReport,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowTextureResourceReport,
  shadowDepthResourceSummaryReportToJson,
  shadowDepthResourceSummaryReportToJsonValue,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("shadow depth resource summary", () => {
  it("summarizes live depth texture resources and deferred shadow stages", () => {
    const report = createShadowDepthResourceSummaryReport({
      depthTextureResources: createShadowDepthTextureResourceReport({
        device: deviceWithTextures(),
        textures: textures(),
      }),
    });
    const json = shadowDepthResourceSummaryReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      counts: {
        textureDescriptors: 1,
        depthTextureResources: 1,
      },
      sections: {
        textureDescriptors: true,
        depthTextureResource: true,
        gpuAllocation: true,
        matrixUpload: false,
        passSubmission: false,
        shaderSampling: false,
      },
      resourceKeys: {
        textures: ["shadow-map:7:light:11:texture"],
        views: ["shadow-map:7:light:11:view"],
      },
      diagnostics: [
        {
          code: "shadowDepthResourceSummary.matrixUploadDeferred",
          severity: "warning",
          message:
            "Shadow depth texture resources are available, but shadow matrix upload remains deferred.",
        },
        {
          code: "shadowDepthResourceSummary.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow depth texture resources are available, but shadow pass submission remains deferred.",
        },
        {
          code: "shadowDepthResourceSummary.shaderSamplingDeferred",
          severity: "warning",
          message:
            "Shadow depth texture resources are available, but StandardMaterial shadow sampling remains deferred.",
        },
      ],
    });
    expect(JSON.parse(shadowDepthResourceSummaryReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|raw/);
  });

  it("reports missing depth texture resources", () => {
    const report = createShadowDepthResourceSummaryReport({
      depthTextureResources: createShadowDepthTextureResourceReport({
        device: {},
        textures: textures(),
      }),
    });
    const json = shadowDepthResourceSummaryReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        textureDescriptors: 1,
        depthTextureResources: 0,
      },
      sections: {
        textureDescriptors: true,
        depthTextureResource: false,
        gpuAllocation: false,
      },
      resourceKeys: {
        textures: [],
        views: [],
      },
      diagnostics: [
        {
          code: "shadowDepthResourceSummary.depthTextureResourceMissing",
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

function deviceWithTextures(): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => ({
      createView: () => ({ descriptor }),
    }),
  };
}
