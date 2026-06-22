import { describe, expect, it } from "vitest";

import {
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  shadowPassPlanReportToJson,
  shadowPassPlanReportToJsonValue,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("shadow pass planning", () => {
  it("plans JSON-safe shadow passes without submitting GPU commands", () => {
    const report = createShadowPassPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      textures: createShadowTextureResourceReport({
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
      }),
    });
    const json = shadowPassPlanReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      requestCount: 1,
      textureCount: 1,
      passCount: 1,
      sections: {
        shadowRequests: true,
        textureResources: true,
        passPlans: true,
        passSubmission: false,
        gpuCommands: false,
      },
      passes: [
        {
          shadowId: 7,
          lightId: 11,
          lightKind: "directional",
          cascadeIndex: 0,
          cascadeCount: 1,
          faceIndex: 0,
          faceCount: 1,
          passKey: "shadow-pass:7:light:11",
          resourceKey: "shadow-map:7:light:11",
          textureKey: "shadow-map:7:light:11:texture",
          viewKey: "shadow-map:7:light:11:view",
          width: 1024,
          height: 1024,
          depthFormat: "depth24plus",
          casterLayerMask: 1,
          receiverLayerMask: 2,
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
          submission: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "shadowPassPlan.submissionDeferred",
          severity: "warning",
          message:
            "Shadow pass descriptors are planned, but GPU command submission is not implemented yet.",
        },
      ],
    });
    expect(JSON.parse(shadowPassPlanReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUTextureView|GPURenderPass|GPUCommandEncoder|raw/,
    );
  });

  it("fans a directional shadow request into one pass per cascade", () => {
    const report = createShadowPassPlanReport({
      shadowRequests: [{ ...shadowRequest(7, 11), cascadeCount: 3 }],
      textures: createShadowTextureResourceReport({
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
      }),
    });
    const json = shadowPassPlanReportToJsonValue(report);

    expect(json.passCount).toBe(3);
    expect(json.passes.map((pass) => pass.cascadeIndex)).toEqual([0, 1, 2]);
    expect(json.passes.map((pass) => pass.passKey)).toEqual([
      "shadow-pass:7:light:11:cascade:0",
      "shadow-pass:7:light:11:cascade:1",
      "shadow-pass:7:light:11:cascade:2",
    ]);
  });

  it("reports missing texture resources", () => {
    const report = createShadowPassPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [shadowRequest(7, 11)],
          descriptors: [],
        }),
      }),
    });
    const json = shadowPassPlanReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("missing");
    expect(json.passCount).toBe(0);
    expect(json.sections).toEqual({
      shadowRequests: true,
      textureResources: false,
      passPlans: false,
      passSubmission: false,
      gpuCommands: false,
    });
    expect(json.diagnostics).toEqual([
      {
        code: "shadowPassPlan.missingTextureResources",
        severity: "warning",
        message:
          "Shadow pass planning requires valid renderer-owned shadow texture resource descriptors.",
      },
    ]);
  });

  it("can report unsupported or ready submission policy without raw handles", () => {
    const textures = createShadowTextureResourceReport({
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

    const unsupported = shadowPassPlanReportToJsonValue(
      createShadowPassPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        textures,
        submission: "unsupported",
      }),
    );
    const ready = shadowPassPlanReportToJsonValue(
      createShadowPassPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        textures,
        submission: "ready",
      }),
    );

    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.ready).toBe(false);
    expect(unsupported.diagnostics).toEqual([
      {
        code: "shadowPassPlan.submissionUnsupported",
        severity: "warning",
        message:
          "Shadow pass submission is not supported for the planned shadow resources.",
      },
    ]);
    expect(ready.status).toBe("ready");
    expect(ready.ready).toBe(true);
    expect(ready.sections.passSubmission).toBe(true);
    expect(ready.sections.gpuCommands).toBe(true);
    expect(ready.diagnostics).toEqual([]);
  });

  it("loads repeated atlas depth views after the first clear", () => {
    const shadowRequests: ShadowRequestPacket[] = [
      { ...shadowRequest(13, 21), lightKind: "spot" },
      { ...shadowRequest(14, 22), lightKind: "spot" },
    ];
    const report = createShadowPassPlanReport({
      shadowRequests,
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests,
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
        }),
      }),
      submission: "ready",
    });

    expect(report.ready).toBe(true);
    expect(report.passes).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        resourceKey: "shadow-map:clustered-spot-atlas",
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        width: 384,
        height: 256,
        depthLoadOp: "clear",
      },
      {
        shadowId: 14,
        lightId: 22,
        resourceKey: "shadow-map:clustered-spot-atlas",
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        width: 384,
        height: 256,
        depthLoadOp: "load",
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
