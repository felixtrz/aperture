import { describe, expect, it } from "vitest";

import {
  createShadowPassAttachmentDescriptorReport,
  shadowPassAttachmentDescriptorReportToJson,
  shadowPassAttachmentDescriptorReportToJsonValue,
  type ShadowDepthTextureResourceReport,
  type ShadowPassPlanReport,
} from "@aperture-engine/webgpu";

describe("shadow pass attachment descriptors", () => {
  it("maps shadow pass plans to live depth attachment descriptors", () => {
    const report = createShadowPassAttachmentDescriptorReport({
      shadowPassPlan: passPlan("ready"),
      depthTextureResources: depthResources("available"),
    });
    const json = shadowPassAttachmentDescriptorReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "ready",
      passCount: 1,
      attachmentCount: 1,
      sections: {
        passPlans: true,
        depthTextureResources: true,
        depthAttachments: true,
        commandEncoder: false,
        passSubmission: false,
        shaderSampling: false,
      },
      attachments: [
        {
          passKey: "shadow-pass:7:light:11",
          shadowId: 7,
          lightId: 11,
          textureKey: "shadow-map:7:light:11:texture",
          viewKey: "shadow-map:7:light:11:view",
          width: 1024,
          height: 1024,
          depthFormat: "depth24plus",
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
        },
      ],
      diagnostics: [],
    });
    expect(
      JSON.parse(shadowPassAttachmentDescriptorReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTextureView|GPURenderPass|GPUCommandEncoder|"raw"|callback/,
    );
  });

  it("preserves deferred pass-submission status after attachment planning", () => {
    const json = shadowPassAttachmentDescriptorReportToJsonValue(
      createShadowPassAttachmentDescriptorReport({
        shadowPassPlan: passPlan("deferred"),
        depthTextureResources: depthResources("available"),
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "deferred",
      passCount: 1,
      attachmentCount: 1,
      sections: {
        depthAttachments: true,
        commandEncoder: false,
        passSubmission: false,
        shaderSampling: false,
      },
      diagnostics: [
        {
          code: "shadowPassAttachmentDescriptor.passSubmissionDeferred",
          severity: "warning",
        },
      ],
    });
  });

  it("preserves clear/load operations for repeated atlas depth views", () => {
    const json = shadowPassAttachmentDescriptorReportToJsonValue(
      createShadowPassAttachmentDescriptorReport({
        shadowPassPlan: atlasPassPlan(),
        depthTextureResources: atlasDepthResources(),
      }),
    );

    expect(json.ready).toBe(true);
    expect(json.attachments).toMatchObject([
      {
        passKey: "shadow-pass:13:light:21",
        shadowId: 13,
        lightId: 21,
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        width: 384,
        height: 256,
        depthLoadOp: "clear",
      },
      {
        passKey: "shadow-pass:14:light:22",
        shadowId: 14,
        lightId: 22,
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        width: 384,
        height: 256,
        depthLoadOp: "load",
      },
    ]);
  });

  it("reports missing pass plans and depth views", () => {
    const missingPass = shadowPassAttachmentDescriptorReportToJsonValue(
      createShadowPassAttachmentDescriptorReport({
        shadowPassPlan: { ...passPlan("missing"), passCount: 0, passes: [] },
        depthTextureResources: depthResources("available"),
      }),
    );
    const missingDepthView = shadowPassAttachmentDescriptorReportToJsonValue(
      createShadowPassAttachmentDescriptorReport({
        shadowPassPlan: passPlan("ready"),
        depthTextureResources: depthResources("missing"),
      }),
    );

    expect(missingPass).toMatchObject({
      ready: false,
      status: "missing",
      attachmentCount: 0,
      diagnostics: [
        {
          code: "shadowPassAttachmentDescriptor.missingPassPlan",
        },
      ],
    });
    expect(missingDepthView).toMatchObject({
      ready: false,
      status: "missing",
      attachmentCount: 0,
      diagnostics: [
        {
          code: "shadowPassAttachmentDescriptor.missingDepthView",
          resourceKey: "shadow-map:7:light:11:view",
        },
      ],
    });
  });
});

function passPlan(
  status: ShadowPassPlanReport["status"],
): ShadowPassPlanReport {
  return {
    ready: status === "ready" || status === "not-required",
    status,
    requestCount: status === "not-required" ? 0 : 1,
    textureCount: status === "not-required" ? 0 : 1,
    passCount: status === "not-required" ? 0 : 1,
    sections: {
      shadowRequests: true,
      textureResources: status !== "missing",
      passPlans: status !== "missing",
      passSubmission: status === "ready" || status === "not-required",
      gpuCommands: false,
    },
    passes:
      status === "not-required"
        ? []
        : [
            {
              shadowId: 7,
              lightId: 11,
              lightKind: "directional",
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
              receiverLayerMask: 1,
              depthLoadOp: "clear",
              depthStoreOp: "store",
              depthClearValue: 1,
              submission: status === "ready" ? "ready" : "deferred",
            },
          ],
    diagnostics: [],
  };
}

function atlasPassPlan(): ShadowPassPlanReport {
  return {
    ready: true,
    status: "ready",
    requestCount: 2,
    textureCount: 2,
    passCount: 2,
    sections: {
      shadowRequests: true,
      textureResources: true,
      passPlans: true,
      passSubmission: true,
      gpuCommands: false,
    },
    passes: [
      {
        shadowId: 13,
        lightId: 21,
        lightKind: "spot",
        faceIndex: 0,
        faceCount: 1,
        passKey: "shadow-pass:13:light:21",
        resourceKey: "shadow-map:clustered-spot-atlas",
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        width: 384,
        height: 256,
        depthFormat: "depth24plus",
        casterLayerMask: 2,
        receiverLayerMask: 2,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1,
        submission: "ready",
      },
      {
        shadowId: 14,
        lightId: 22,
        lightKind: "spot",
        faceIndex: 0,
        faceCount: 1,
        passKey: "shadow-pass:14:light:22",
        resourceKey: "shadow-map:clustered-spot-atlas",
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        width: 384,
        height: 256,
        depthFormat: "depth24plus",
        casterLayerMask: 2,
        receiverLayerMask: 2,
        depthLoadOp: "load",
        depthStoreOp: "store",
        depthClearValue: 1,
        submission: "ready",
      },
    ],
    diagnostics: [],
  };
}

function atlasDepthResources(): ShadowDepthTextureResourceReport {
  const attachmentView = {
    faceIndex: 0,
    viewKey: "shadow-map:clustered-spot-atlas:view",
    view: {},
  };
  const allocation = {
    valid: true as const,
    resource: {
      resourceKey: "shadow-map:clustered-spot-atlas:texture",
      texture: {},
      view: {},
      descriptor: {
        size: [384, 256, 1] as const,
        format: "depth24plus",
        usage: 20,
      },
    },
    diagnostics: [],
  };

  return {
    ready: true,
    status: "available",
    textureDescriptorCount: 2,
    createdTextureCount: 1,
    reusedTextureCount: 0,
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
        shadowId: 13,
        lightId: 21,
        resourceKey: "shadow-map:clustered-spot-atlas",
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        layerCount: 1,
        layerBaseIndex: 0,
        faceCount: 1,
        viewDimension: "2d",
        attachmentViews: [attachmentView],
        allocation,
      },
      {
        shadowId: 14,
        lightId: 22,
        resourceKey: "shadow-map:clustered-spot-atlas",
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewKey: "shadow-map:clustered-spot-atlas:view",
        layerCount: 1,
        layerBaseIndex: 0,
        faceCount: 1,
        viewDimension: "2d",
        attachmentViews: [attachmentView],
        allocation,
      },
    ],
    diagnostics: [],
  };
}

function depthResources(
  status: ShadowDepthTextureResourceReport["status"],
): ShadowDepthTextureResourceReport {
  return {
    ready: status === "available" || status === "not-required",
    status,
    textureDescriptorCount: status === "not-required" ? 0 : 1,
    createdTextureCount: status === "available" ? 1 : 0,
    reusedTextureCount: 0,
    sections: {
      textureDescriptors: status !== "missing",
      depthTextureResource: status === "available",
      gpuAllocation: status === "available",
      matrixUpload: false,
      passSubmission: false,
      shaderSampling: false,
    },
    resources:
      status === "not-required"
        ? []
        : [
            {
              shadowId: 7,
              lightId: 11,
              resourceKey: "shadow-map:7:light:11",
              textureKey: "shadow-map:7:light:11:texture",
              viewKey: "shadow-map:7:light:11:view",
              faceCount: 1,
              viewDimension: "2d",
              attachmentViews:
                status === "available"
                  ? [
                      {
                        faceIndex: 0,
                        viewKey: "shadow-map:7:light:11:view",
                        view: {},
                      },
                    ]
                  : [],
              allocation: {
                valid: status === "available",
                resource:
                  status === "available"
                    ? {
                        resourceKey: "shadow-map:7:light:11:texture",
                        texture: {},
                        view: {},
                        descriptor: {
                          size: [1024, 1024, 1],
                          format: "depth24plus",
                          usage: 20,
                        },
                      }
                    : null,
                diagnostics: [],
              },
            },
          ],
    diagnostics: [],
  };
}
