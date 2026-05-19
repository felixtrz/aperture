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
          resourceKey: "shadow-map:7:light:11",
          textureKey: "shadow-map:7:light:11:texture",
          viewKey: "shadow-map:7:light:11:view",
          width: 1024,
          height: 1024,
          depthFormat: "depth24plus",
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
