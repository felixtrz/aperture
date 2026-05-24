import { describe, expect, it } from "vitest";

import {
  createShadowMapDescriptorReport,
  shadowMapDescriptorReportToJson,
  shadowMapDescriptorReportToJsonValue,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu";

describe("shadow-map descriptors", () => {
  it("creates renderer-owned descriptor keys from extracted shadow requests", () => {
    const report = createShadowMapDescriptorReport({
      shadowRequests: [shadowRequest(7, 11)],
      descriptors: [
        {
          shadowId: 7,
          lightId: 11,
          mapSize: 1024,
          depthBias: 0.001,
          normalBias: 0.01,
        },
      ],
    });
    const json = shadowMapDescriptorReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      requestCount: 1,
      descriptorCount: 1,
      sections: {
        shadowRequests: true,
        shadowMapDescriptors: true,
        shadowPassSubmission: false,
      },
      descriptors: [
        {
          shadowId: 7,
          lightId: 11,
          lightKind: "directional",
          resourceKey: "shadow-map:7:light:11",
          depthFormat: "depth24plus",
          mapSize: 1024,
          textureWidth: 1024,
          textureHeight: 1024,
          depthBias: 0.001,
          normalBias: 0.01,
          filterRadiusTexels: 1,
          cascadeCount: 1,
          faceCount: 1,
          viewDimension: "2d",
          layerCount: 1,
          layerBaseIndex: 0,
          casterLayerMask: 1,
          receiverLayerMask: 2,
          ready: true,
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(shadowMapDescriptorReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPURenderPass|handle/);
  });

  it("carries directional cascade counts into descriptor metadata", () => {
    const report = createShadowMapDescriptorReport({
      shadowRequests: [{ ...shadowRequest(7, 11), cascadeCount: 3 }],
      descriptors: [
        {
          shadowId: 7,
          lightId: 11,
          mapSize: 1024,
          depthBias: 0.001,
        },
      ],
    });
    const json = shadowMapDescriptorReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.descriptors[0]).toMatchObject({
      cascadeCount: 3,
      faceCount: 1,
      viewDimension: "2d-array",
    });
  });

  it("carries compatible local spot-shadow array layer metadata", () => {
    const report = createShadowMapDescriptorReport({
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
    });

    expect(report.ready).toBe(true);
    expect(report.descriptors).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        lightKind: "spot",
        resourceKey: "shadow-map:clustered-spot-array",
        viewDimension: "2d-array",
        layerCount: 2,
        layerBaseIndex: 0,
      },
      {
        shadowId: 14,
        lightId: 22,
        lightKind: "spot",
        resourceKey: "shadow-map:clustered-spot-array",
        viewDimension: "2d-array",
        layerCount: 2,
        layerBaseIndex: 1,
      },
    ]);
  });

  it("carries shared atlas texture dimensions for nonuniform local spot shadows", () => {
    const report = createShadowMapDescriptorReport({
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
        },
      ],
    });

    expect(report.ready).toBe(true);
    expect(report.descriptors).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        lightKind: "spot",
        resourceKey: "shadow-map:clustered-spot-atlas",
        mapSize: 256,
        textureWidth: 384,
        textureHeight: 256,
        viewDimension: "2d",
        layerCount: 1,
        layerBaseIndex: 0,
      },
      {
        shadowId: 14,
        lightId: 22,
        lightKind: "spot",
        resourceKey: "shadow-map:clustered-spot-atlas",
        mapSize: 128,
        textureWidth: 384,
        textureHeight: 256,
        viewDimension: "2d",
        layerCount: 1,
        layerBaseIndex: 0,
      },
    ]);
  });

  it("diagnoses missing descriptors without creating renderer state", () => {
    const report = createShadowMapDescriptorReport({
      shadowRequests: [shadowRequest(7, 11)],
      descriptors: [],
    });
    const json = shadowMapDescriptorReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.descriptorCount).toBe(0);
    expect(json.sections).toEqual({
      shadowRequests: true,
      shadowMapDescriptors: false,
      shadowPassSubmission: false,
    });
    expect(json.diagnostics).toEqual([
      {
        code: "shadowMapDescriptor.missingDescriptor",
        severity: "warning",
        shadowId: 7,
        lightId: 11,
        message:
          "Shadow request '7' for light '11' has no renderer-owned shadow-map descriptor.",
      },
    ]);
  });

  it("diagnoses invalid map sizes", () => {
    const report = createShadowMapDescriptorReport({
      shadowRequests: [shadowRequest(7, 11)],
      descriptors: [
        {
          shadowId: 7,
          lightId: 11,
          mapSize: 0,
          depthBias: 0,
        },
      ],
    });
    const json = shadowMapDescriptorReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.diagnostics).toMatchObject([
      {
        code: "shadowMapDescriptor.invalidMapSize",
        severity: "error",
        shadowId: 7,
        lightId: 11,
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
