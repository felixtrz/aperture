import { describe, expect, it } from "vitest";

import {
  createShadowMapDescriptorReport,
  createShadowTextureResourceReport,
  shadowTextureResourceReportToJson,
  shadowTextureResourceReportToJsonValue,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu";

describe("shadow texture resources", () => {
  it("plans JSON-safe texture descriptors without allocating GPU textures", () => {
    const report = createShadowTextureResourceReport({
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
    const json = shadowTextureResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      descriptorCount: 1,
      textureCount: 1,
      sections: {
        shadowMapDescriptors: true,
        textureDescriptors: true,
        gpuAllocation: false,
      },
      textures: [
        {
          shadowId: 7,
          lightId: 11,
          lightKind: "directional",
          resourceKey: "shadow-map:7:light:11",
          textureKey: "shadow-map:7:light:11:texture",
          viewKey: "shadow-map:7:light:11:view",
          attachmentViewKeys: ["shadow-map:7:light:11:view"],
          width: 1024,
          height: 1024,
          depthFormat: "depth24plus",
          filterRadiusTexels: 1,
          cascadeCount: 1,
          layerCount: 1,
          layerBaseIndex: 0,
          faceCount: 1,
          viewDimension: "2d",
          usageIntent: "render-attachment",
          allocation: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "shadowTextureResource.allocationDeferred",
          severity: "warning",
          message:
            "Shadow texture descriptors are planned, but live GPU texture allocation is not implemented yet.",
        },
      ],
    });
    expect(JSON.parse(shadowTextureResourceReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|raw/);
  });

  it("plans one attachment view per directional cascade", () => {
    const report = createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [{ ...shadowRequest(7, 11), cascadeCount: 3 }],
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
    const json = shadowTextureResourceReportToJsonValue(report);

    expect(json.textureCount).toBe(1);
    expect(json.textures[0]).toMatchObject({
      cascadeCount: 3,
      layerCount: 3,
      viewDimension: "2d-array",
      attachmentViewKeys: [
        "shadow-map:7:light:11:cascade-0:view",
        "shadow-map:7:light:11:cascade-1:view",
        "shadow-map:7:light:11:cascade-2:view",
      ],
    });
  });

  it("plans shared 2d-array descriptors for compatible local spot shadows", () => {
    const report = createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [
          { ...shadowRequest(13, 21), lightKind: "spot" },
          { ...shadowRequest(14, 22), lightKind: "spot" },
        ],
        descriptors: [
          {
            shadowId: 13,
            lightId: 21,
            mapSize: 512,
            depthBias: 0.002,
            resourceKey: "shadow-map:clustered-spot-array",
            viewDimension: "2d-array",
            layerCount: 2,
            layerBaseIndex: 0,
          },
          {
            shadowId: 14,
            lightId: 22,
            mapSize: 512,
            depthBias: 0.002,
            resourceKey: "shadow-map:clustered-spot-array",
            viewDimension: "2d-array",
            layerCount: 2,
            layerBaseIndex: 1,
          },
        ],
      }),
    });

    expect(report.textureCount).toBe(2);
    expect(report.textures.map((texture) => texture.textureKey)).toEqual([
      "shadow-map:clustered-spot-array:texture",
      "shadow-map:clustered-spot-array:texture",
    ]);
    expect(report.textures).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        viewDimension: "2d-array",
        layerCount: 2,
        layerBaseIndex: 0,
        attachmentViewKeys: ["shadow-map:clustered-spot-array:layer-0:view"],
      },
      {
        shadowId: 14,
        lightId: 22,
        viewDimension: "2d-array",
        layerCount: 2,
        layerBaseIndex: 1,
        attachmentViewKeys: ["shadow-map:clustered-spot-array:layer-1:view"],
      },
    ]);
  });

  it("plans shared 2d atlas descriptors for nonuniform local spot shadows", () => {
    const report = createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [
          { ...shadowRequest(13, 21), lightKind: "spot" },
          { ...shadowRequest(14, 22), lightKind: "spot" },
        ],
        descriptors: [
          {
            shadowId: 13,
            lightId: 21,
            mapSize: 256,
            textureWidth: 384,
            textureHeight: 256,
            depthBias: 0.002,
            resourceKey: "shadow-map:clustered-spot-atlas",
            viewDimension: "2d",
            atlasRegion: { originX: 0, originY: 0, width: 256, height: 256 },
          },
          {
            shadowId: 14,
            lightId: 22,
            mapSize: 128,
            textureWidth: 384,
            textureHeight: 256,
            depthBias: 0.002,
            resourceKey: "shadow-map:clustered-spot-atlas",
            viewDimension: "2d",
            atlasRegion: { originX: 256, originY: 0, width: 128, height: 128 },
          },
        ],
      }),
    });

    expect(report.textureCount).toBe(2);
    expect(report.textures.map((texture) => texture.textureKey)).toEqual([
      "shadow-map:clustered-spot-atlas:texture",
      "shadow-map:clustered-spot-atlas:texture",
    ]);
    expect(report.textures).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        width: 384,
        height: 256,
        viewDimension: "2d",
        layerCount: 1,
        layerBaseIndex: 0,
        atlasRegion: { originX: 0, originY: 0, width: 256, height: 256 },
        attachmentViewKeys: ["shadow-map:clustered-spot-atlas:view"],
      },
      {
        shadowId: 14,
        lightId: 22,
        width: 384,
        height: 256,
        viewDimension: "2d",
        layerCount: 1,
        layerBaseIndex: 0,
        atlasRegion: { originX: 256, originY: 0, width: 128, height: 128 },
        attachmentViewKeys: ["shadow-map:clustered-spot-atlas:view"],
      },
    ]);
  });

  it("reports missing shadow-map descriptors", () => {
    const report = createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest(7, 11)],
        descriptors: [],
      }),
    });
    const json = shadowTextureResourceReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.textureCount).toBe(0);
    expect(json.sections).toEqual({
      shadowMapDescriptors: false,
      textureDescriptors: false,
      gpuAllocation: false,
    });
    expect(json.diagnostics).toEqual([
      {
        code: "shadowTextureResource.missingDescriptors",
        severity: "warning",
        message:
          "Shadow texture resource planning requires valid shadow-map descriptors.",
      },
    ]);
  });
});

function shadowRequest(shadowId: number, lightId: number): ShadowRequestPacket {
  return {
    shadowId,
    lightId,
    casterLayerMask: 1,
    receiverLayerMask: 2,
  };
}
