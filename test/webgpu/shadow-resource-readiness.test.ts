import { describe, expect, it } from "vitest";

import {
  createShadowMapDescriptorReport,
  createShadowResourceReadinessReport,
  shadowResourceReadinessReportToJson,
  shadowResourceReadinessReportToJsonValue,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("shadow resource readiness", () => {
  it("reports descriptor-backed resources while keeping pass submission deferred", () => {
    const report = createShadowResourceReadinessReport({
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
    const json = shadowResourceReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      requestCount: 1,
      descriptorCount: 1,
      resourceKeys: ["shadow-map:7:light:11"],
      sections: {
        shadowMapDescriptors: true,
        shadowMapResources: true,
        shadowPassSubmission: false,
      },
      diagnostics: [
        {
          code: "shadowResourceReadiness.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow-map descriptors are available, but shadow texture allocation and pass submission are not implemented yet.",
        },
      ],
    });
    expect(JSON.parse(shadowResourceReadinessReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPURenderPass|handle/);
  });

  it("reports missing descriptor state", () => {
    const report = createShadowResourceReadinessReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest(7, 11)],
      }),
    });
    const json = shadowResourceReadinessReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("missing");
    expect(json.resourceKeys).toEqual([]);
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowResourceReadiness.missingDescriptors",
      "shadowResourceReadiness.passSubmissionDeferred",
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
