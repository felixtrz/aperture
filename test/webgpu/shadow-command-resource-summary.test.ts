import { describe, expect, it } from "vitest";

import {
  createShadowCommandResourceSummaryReport,
  shadowCommandResourceSummaryReportToJson,
  shadowCommandResourceSummaryReportToJsonValue,
  type DirectionalShadowViewProjectionPlanReport,
  type ShadowCasterCommandPlanReadinessReport,
  type ShadowCasterDrawListPlanReport,
  type ShadowMatrixBufferDescriptorReport,
  type ShadowPassPlanReport,
  type ShadowTextureResourceReport,
} from "@aperture-engine/webgpu/test-support";

describe("shadow command resource summary", () => {
  it("summarizes deferred shadow resources and command plans", () => {
    const report = createShadowCommandResourceSummaryReport(deferredInput());
    const json = shadowCommandResourceSummaryReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      counts: {
        requests: 1,
        textures: 1,
        passes: 1,
        viewProjectionPlans: 1,
        matrices: 1,
        casterLists: 1,
        commandPlans: 1,
        drawCommands: 3,
      },
      sections: {
        textureResources: true,
        passPlans: true,
        viewProjectionPlanning: true,
        matrixBufferDescriptor: true,
        casterDrawLists: true,
        commandPlans: true,
        gpuAllocation: false,
        commandEncoding: false,
      },
      resourceKeys: {
        textures: ["shadow-map:7:light:11:texture"],
        views: ["shadow-map:7:light:11:view"],
        passes: ["shadow-pass:7:light:11"],
        matrixBuffers: ["shadow-matrix-buffer:directional"],
        commands: ["shadow-pass:7:light:11:caster-commands"],
      },
      diagnostics: [
        {
          code: "shadowCommandResourceSummary.textureAllocationDeferred",
          severity: "warning",
          message:
            "Shadow texture resources are planned, but GPU texture allocation is deferred.",
        },
        {
          code: "shadowCommandResourceSummary.commandEncodingDeferred",
          severity: "warning",
          message:
            "Shadow command plans are available as data, but GPU command encoding is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCommandResourceSummaryReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUBuffer|GPUCommandEncoder|GPURenderPass|"raw"/,
    );
  });

  it("reports missing prerequisites and not-required shadow work", () => {
    const missing = shadowCommandResourceSummaryReportToJsonValue(
      createShadowCommandResourceSummaryReport({
        textures: {
          ...textureReport(),
          ready: false,
          textureCount: 0,
          textures: [],
        },
        passPlan: { ...passPlan(), status: "missing", passes: [] },
        viewProjection: {
          ...viewProjection(),
          status: "missing",
          plans: [],
          planCount: 0,
        },
        matrixBuffer: {
          ...matrixBuffer(),
          status: "missing",
          descriptor: null,
          matrixCount: 0,
        },
        casterDrawList: {
          ...casterDrawList(),
          status: "missing",
          lists: [],
          listCount: 0,
        },
        commandPlan: {
          ...commandPlan(),
          status: "missing",
          commands: [],
          counts: { ...commandPlan().counts, commandPlans: 0, drawCommands: 0 },
        },
      }),
    );
    const notRequired = shadowCommandResourceSummaryReportToJsonValue(
      createShadowCommandResourceSummaryReport({
        textures: { ...textureReport(), textureCount: 0, textures: [] },
        passPlan: {
          ...passPlan(),
          status: "not-required",
          requestCount: 0,
          passCount: 0,
          passes: [],
        },
        viewProjection: {
          ...viewProjection(),
          status: "not-required",
          planCount: 0,
          plans: [],
        },
        matrixBuffer: {
          ...matrixBuffer(),
          status: "not-required",
          matrixCount: 0,
          descriptor: null,
        },
        casterDrawList: {
          ...casterDrawList(),
          status: "not-required",
          listCount: 0,
          lists: [],
        },
        commandPlan: {
          ...commandPlan(),
          status: "not-required",
          commands: [],
          counts: {
            ...commandPlan().counts,
            requests: 0,
            commandPlans: 0,
            drawCommands: 0,
          },
        },
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCommandResourceSummary.missingTextureResources",
      "shadowCommandResourceSummary.missingPassPlan",
      "shadowCommandResourceSummary.missingViewProjection",
      "shadowCommandResourceSummary.missingMatrixBuffer",
      "shadowCommandResourceSummary.missingCasterDrawList",
      "shadowCommandResourceSummary.missingCommandPlan",
    ]);
    expect(notRequired).toMatchObject({
      ready: true,
      status: "not-required",
      counts: {
        requests: 0,
        commandPlans: 0,
        drawCommands: 0,
      },
      diagnostics: [],
    });
  });
});

function deferredInput() {
  return {
    textures: textureReport(),
    passPlan: passPlan(),
    viewProjection: viewProjection(),
    matrixBuffer: matrixBuffer(),
    casterDrawList: casterDrawList(),
    commandPlan: commandPlan(),
  };
}

function textureReport(): ShadowTextureResourceReport {
  return {
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
        faceCount: 1,
        viewDimension: "2d",
        usageIntent: "render-attachment",
        allocation: "deferred",
      },
    ],
    diagnostics: [],
  };
}

function passPlan(): ShadowPassPlanReport {
  return {
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
        submission: "deferred",
      },
    ],
    diagnostics: [],
  };
}

function viewProjection(): DirectionalShadowViewProjectionPlanReport {
  return {
    ready: false,
    status: "deferred",
    requestCount: 1,
    passCount: 1,
    planCount: 1,
    sections: {
      shadowRequests: true,
      lightPackets: true,
      passPlans: true,
      matrixPlanning: false,
      gpuResources: false,
    },
    plans: [
      {
        shadowId: 7,
        lightId: 11,
        planKey: "directional-shadow-view-projection:7:light:11",
        passKey: "shadow-pass:7:light:11",
        lightKind: "directional",
        lightTransformOffset: 64,
        mapSize: 1024,
        casterLayerMask: 1,
        receiverLayerMask: 1,
        projection: "orthographic",
        viewMatrixKey: "shadow-pass:7:light:11:view",
        projectionMatrixKey: "shadow-pass:7:light:11:projection",
        viewProjectionMatrixKey: "shadow-pass:7:light:11:view-projection",
        computation: "deferred",
      },
    ],
    diagnostics: [],
  };
}

function matrixBuffer(): ShadowMatrixBufferDescriptorReport {
  return {
    ready: false,
    status: "deferred",
    planCount: 1,
    matrixCount: 1,
    byteSize: 64,
    sections: {
      viewProjectionPlanning: true,
      bufferDescriptor: true,
      gpuAllocation: false,
      upload: false,
    },
    descriptor: {
      resourceKey: "shadow-matrix-buffer:directional",
      label: "DirectionalShadowMatrices/storage",
      usage: "read-only-storage-buffer",
      matrixCount: 1,
      strideBytes: 64,
      byteSize: 64,
      entries: [],
    },
    diagnostics: [],
  };
}

function casterDrawList(): ShadowCasterDrawListPlanReport {
  return {
    ready: false,
    status: "deferred",
    requestCount: 1,
    meshDrawCount: 3,
    listCount: 1,
    includedDrawCount: 3,
    skippedDrawCount: 0,
    sections: {
      shadowRequests: true,
      passPlans: true,
      casterFiltering: true,
      commandEncoding: false,
    },
    lists: [],
    diagnostics: [],
  };
}

function commandPlan(): ShadowCasterCommandPlanReadinessReport {
  return {
    ready: false,
    status: "deferred",
    counts: {
      requests: 1,
      passes: 1,
      viewProjectionPlans: 1,
      matrices: 1,
      casterLists: 1,
      drawCommands: 3,
      commandPlans: 1,
    },
    sections: {
      shadowPassPlan: true,
      viewProjectionPlanning: true,
      matrixBufferDescriptor: true,
      casterDrawLists: true,
      commandEncoding: false,
      gpuCommands: false,
    },
    commands: [
      {
        commandKey: "shadow-pass:7:light:11:caster-commands",
        shadowId: 7,
        lightId: 11,
        passKey: "shadow-pass:7:light:11",
        matrixResourceKey: "shadow-matrix-buffer:directional",
        matrixOffsetBytes: 0,
        drawCount: 3,
        commandEncoding: "deferred",
      },
    ],
    diagnostics: [],
  };
}
