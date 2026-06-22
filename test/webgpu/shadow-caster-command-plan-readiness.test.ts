import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowViewProjectionPlanReport,
  createMaterialHandle,
  createMeshHandle,
  createShadowCasterCommandPlanReadinessReport,
  createShadowCasterCommandPlanReadinessScratch,
  createShadowCasterDrawListPlanReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  shadowCasterCommandPlanReadinessReportToJson,
  shadowCasterCommandPlanReadinessReportToJsonValue,
  writeShadowCasterCommandPlanReadinessReport,
  type LightPacket,
  type MeshDrawPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster command-plan readiness", () => {
  it("summarizes deferred command plans without command encoders", () => {
    const report = commandPlan();
    const json = shadowCasterCommandPlanReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      counts: {
        requests: 1,
        passes: 1,
        viewProjectionPlans: 1,
        matrices: 1,
        casterLists: 1,
        drawCommands: 1,
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
          drawCount: 1,
          commandEncoding: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "shadowCasterCommandPlan.commandEncodingDeferred",
          severity: "warning",
          message:
            "Shadow caster command plans are ready as data, but GPU command encoding is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCasterCommandPlanReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUCommandEncoder|GPURenderPass|GPUTexture|"raw"|callback/,
    );
  });

  it("reports missing prerequisites and not-required work", () => {
    const missingPass = shadowPassPlan([shadowRequest()], []);
    const missingViewProjection =
      createDirectionalShadowViewProjectionPlanReport({
        shadowRequests: [shadowRequest()],
        lights: [],
        shadowPassPlan: shadowPassPlan(),
      });
    const missingMatrix = createShadowMatrixBufferDescriptorReport({
      viewProjection: missingViewProjection,
    });
    const missingDrawList = createShadowCasterDrawListPlanReport({
      shadowRequests: [shadowRequest()],
      meshDraws: [meshDraw()],
      shadowPassPlan: missingPass,
    });
    const missing = shadowCasterCommandPlanReadinessReportToJsonValue(
      createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan: missingPass,
        viewProjection: missingViewProjection,
        matrixBuffer: missingMatrix,
        casterDrawList: missingDrawList,
      }),
    );
    const notRequired = shadowCasterCommandPlanReadinessReportToJsonValue(
      createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan: shadowPassPlan([], []),
        viewProjection: createDirectionalShadowViewProjectionPlanReport({
          shadowRequests: [],
          lights: [],
          shadowPassPlan: shadowPassPlan([], []),
        }),
        matrixBuffer: createShadowMatrixBufferDescriptorReport({
          viewProjection: createDirectionalShadowViewProjectionPlanReport({
            shadowRequests: [],
            lights: [],
            shadowPassPlan: shadowPassPlan([], []),
          }),
        }),
        casterDrawList: createShadowCasterDrawListPlanReport({
          shadowRequests: [],
          meshDraws: [],
          shadowPassPlan: shadowPassPlan([], []),
        }),
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterCommandPlan.missingPassPlan",
      "shadowCasterCommandPlan.missingViewProjection",
      "shadowCasterCommandPlan.missingMatrixBuffer",
      "shadowCasterCommandPlan.missingCasterDrawList",
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

  it("can classify future ready command encoding from data-only inputs", () => {
    const report = commandPlan({
      passSubmission: "ready",
      matrixComputation: "ready",
      matrixUpload: "ready",
      drawListEncoding: "ready",
      commandEncoding: "ready",
    });
    const json = shadowCasterCommandPlanReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      status: "ready",
      sections: {
        commandEncoding: true,
        gpuCommands: false,
      },
      diagnostics: [],
    });
    expect(json.commands[0]?.commandEncoding).toBe("ready");
  });

  it("refills caller-owned scratch arrays and command objects", () => {
    const scratch = createShadowCasterCommandPlanReadinessScratch();
    const first = writeShadowCasterCommandPlanReadinessReport(
      commandPlanInput({
        passSubmission: "ready",
        matrixComputation: "ready",
        matrixUpload: "ready",
        drawListEncoding: "ready",
        commandEncoding: "ready",
      }),
      scratch,
    );
    const firstCommands = first.commands;
    const firstCommand = first.commands[0];

    const second = writeShadowCasterCommandPlanReadinessReport(
      commandPlanInput({
        passSubmission: "ready",
        matrixComputation: "ready",
        matrixUpload: "ready",
        drawListEncoding: "ready",
        commandEncoding: "ready",
      }),
      scratch,
    );

    expect(second.commands).toBe(firstCommands);
    expect(second.commands[0]).toBe(firstCommand);
    expect(second).toMatchObject({
      ready: true,
      status: "ready",
      counts: {
        commandPlans: 1,
        drawCommands: 1,
      },
      diagnostics: [],
    });
  });
});

function commandPlan(
  options: {
    readonly passSubmission?: "deferred" | "ready" | "unsupported";
    readonly matrixComputation?: "deferred" | "ready";
    readonly matrixUpload?: "deferred" | "ready";
    readonly drawListEncoding?: "deferred" | "ready";
    readonly commandEncoding?: "deferred" | "ready";
  } = {},
) {
  return createShadowCasterCommandPlanReadinessReport(
    commandPlanInput(options),
  );
}

function commandPlanInput(
  options: {
    readonly passSubmission?: "deferred" | "ready" | "unsupported";
    readonly matrixComputation?: "deferred" | "ready";
    readonly matrixUpload?: "deferred" | "ready";
    readonly drawListEncoding?: "deferred" | "ready";
    readonly commandEncoding?: "deferred" | "ready";
  } = {},
) {
  const passPlanReport = shadowPassPlan(
    [shadowRequest()],
    [shadowDescriptor()],
    options.passSubmission ?? "deferred",
  );
  const viewProjection = createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest()],
    lights: [light()],
    shadowPassPlan: passPlanReport,
    computation: options.matrixComputation ?? "deferred",
  });
  const matrixBuffer = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: options.matrixUpload ?? "deferred",
  });
  const casterDrawList = createShadowCasterDrawListPlanReport({
    shadowRequests: [shadowRequest()],
    meshDraws: [meshDraw()],
    shadowPassPlan: passPlanReport,
    commandEncoding: options.drawListEncoding ?? "deferred",
  });

  return {
    shadowPassPlan: passPlanReport,
    viewProjection,
    matrixBuffer,
    casterDrawList,
    commandEncoding: options.commandEncoding ?? "deferred",
  };
}

function shadowPassPlan(
  requests: readonly ShadowRequestPacket[] = [shadowRequest()],
  descriptors: readonly ReturnType<typeof shadowDescriptor>[] = [
    shadowDescriptor(),
  ],
  submission: "deferred" | "ready" | "unsupported" = "deferred",
) {
  return createShadowPassPlanReport({
    shadowRequests: requests,
    textures: createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: requests,
        descriptors,
      }),
    }),
    submission,
  });
}

function shadowDescriptor() {
  return {
    shadowId: 7,
    lightId: 11,
    mapSize: 1024,
    depthBias: 0.001,
  };
}

function shadowRequest(): ShadowRequestPacket {
  return {
    shadowId: 7,
    lightId: 11,
    casterLayerMask: 1,
    receiverLayerMask: 1,
  };
}

function light(): LightPacket {
  return {
    lightId: 11,
    entity: { index: 11, generation: 0 },
    kind: "directional",
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 64,
    layerMask: 1,
  };
}

function meshDraw(): MeshDrawPacket {
  return {
    renderId: 1,
    entity: { index: 1, generation: 0 },
    mesh: createMeshHandle("mesh-1"),
    material: createMaterialHandle("material-1"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "standard",
      materialKey: "material-1",
      meshKey: "mesh-1",
      depth: 0,
      stableId: 1,
    },
    batchKey: {
      pipelineKey: "standard",
      materialKey: "material-1",
      meshLayoutKey: "mesh-1",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}
