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
          resourceKey: "shadow-map:7:light:11",
          depthFormat: "depth24plus",
          mapSize: 1024,
          depthBias: 0.001,
          normalBias: 0.01,
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
