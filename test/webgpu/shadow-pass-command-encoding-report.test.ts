import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createMaterialHandle,
  createMeshHandle,
  createShadowCasterCommandPlanReadinessReport,
  createShadowCasterDrawListPlanReport,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassCommandEncodingReport,
  createShadowPassCommandEncodingScratch,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  shadowPassCommandEncodingReportToJson,
  shadowPassCommandEncodingReportToJsonValue,
  writeShadowPassCommandEncodingReport,
  type LightPacket,
  type MeshDrawPacket,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("shadow pass command encoding reports", () => {
  it("records JSON-safe command encoding records for ready shadow pass inputs", () => {
    const input = commandEncodingInput({
      passSubmission: "ready",
      matrixComputation: "ready",
      matrixUpload: "ready",
      drawListEncoding: "ready",
      commandPlanEncoding: "ready",
    });
    const report = createShadowPassCommandEncodingReport(input);
    const json = shadowPassCommandEncodingReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "ready",
      counts: {
        passes: 1,
        depthViews: 1,
        matrixBuffers: 1,
        casterLists: 1,
        commandPlans: 1,
        commandRecords: 1,
        drawCommands: 1,
      },
      sections: {
        passPlans: true,
        depthTextureResources: true,
        matrixBufferResource: true,
        casterDrawLists: true,
        commandPlans: true,
        commandEncoding: true,
        passSubmission: false,
        shaderSampling: false,
      },
      records: [
        {
          passKey: "shadow-pass:7:light:11",
          shadowId: 7,
          lightId: 11,
          depthTextureKey: "shadow-map:7:light:11:texture",
          depthViewKey: "shadow-map:7:light:11:view",
          matrixResourceKey: "shadow-matrix-buffer:directional",
          commandKey: "shadow-pass:7:light:11:caster-commands",
          drawCount: 1,
          commandEncoding: "ready",
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(shadowPassCommandEncodingReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(
      /GPUCommandEncoder|GPURenderPass|GPUTexture|GPUBuffer|"raw"|callback/,
    );
  });

  it("reports missing depth views, matrix buffers, caster lists, and command plans", () => {
    const ready = commandEncodingInput({
      passSubmission: "ready",
      matrixComputation: "ready",
      matrixUpload: "ready",
      drawListEncoding: "ready",
      commandPlanEncoding: "ready",
    });
    const missing = shadowPassCommandEncodingReportToJsonValue(
      createShadowPassCommandEncodingReport({
        ...ready,
        depthTextureResources: createShadowDepthTextureResourceReport({
          device: {},
          textures: ready.shadowPassPlanToTextures,
        }),
        matrixBufferResource: createShadowMatrixBufferResourceReport({
          device: {},
          descriptor: ready.shadowMatrixDescriptor,
          matrices: ready.shadowMatrices,
        }),
        casterDrawList: createShadowCasterDrawListPlanReport({
          shadowRequests: [shadowRequest()],
          meshDraws: [meshDraw()],
          shadowPassPlan: createShadowPassPlanReport({
            shadowRequests: [shadowRequest()],
            textures: createShadowTextureResourceReport({
              descriptors: createShadowMapDescriptorReport({
                shadowRequests: [shadowRequest()],
                descriptors: [],
              }),
            }),
            submission: "ready",
          }),
          commandEncoding: "ready",
        }),
        commandPlan: createShadowCasterCommandPlanReadinessReport({
          shadowPassPlan: ready.shadowPassPlan,
          viewProjection: ready.shadowViewProjection,
          matrixBuffer: ready.shadowMatrixDescriptor,
          casterDrawList: createShadowCasterDrawListPlanReport({
            shadowRequests: [shadowRequest()],
            meshDraws: [meshDraw()],
            shadowPassPlan: createShadowPassPlanReport({
              shadowRequests: [shadowRequest()],
              textures: createShadowTextureResourceReport({
                descriptors: createShadowMapDescriptorReport({
                  shadowRequests: [shadowRequest()],
                  descriptors: [],
                }),
              }),
              submission: "ready",
            }),
          }),
          commandEncoding: "ready",
        }),
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.records).toEqual([]);
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowPassCommandEncoding.missingMatrixBuffer",
      "shadowPassCommandEncoding.missingDepthView",
      "shadowPassCommandEncoding.missingCasterDrawList",
      "shadowPassCommandEncoding.missingCommandPlan",
    ]);
  });

  it("refills caller-owned scratch arrays and record objects", () => {
    const input = commandEncodingInput({
      passSubmission: "ready",
      matrixComputation: "ready",
      matrixUpload: "ready",
      drawListEncoding: "ready",
      commandPlanEncoding: "ready",
    });
    const scratch = createShadowPassCommandEncodingScratch();
    const first = writeShadowPassCommandEncodingReport(input, scratch);
    const firstRecords = first.records;
    const firstRecord = first.records[0];
    const second = writeShadowPassCommandEncodingReport(input, scratch);

    expect(second.records).toBe(firstRecords);
    expect(second.records[0]).toBe(firstRecord);
    expect(second).toMatchObject({
      ready: true,
      status: "ready",
      counts: {
        commandRecords: 1,
        drawCommands: 1,
      },
    });
  });
});

function commandEncodingInput(
  options: {
    readonly passSubmission?: "deferred" | "ready" | "unsupported";
    readonly matrixComputation?: "deferred" | "ready";
    readonly matrixUpload?: "deferred" | "ready";
    readonly drawListEncoding?: "deferred" | "ready";
    readonly commandPlanEncoding?: "deferred" | "ready";
  } = {},
) {
  const shadowMapDescriptors = createShadowMapDescriptorReport({
    shadowRequests: [shadowRequest()],
    descriptors: [
      { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
    ],
  });
  const textures = createShadowTextureResourceReport({
    descriptors: shadowMapDescriptors,
  });
  const shadowPassPlan = createShadowPassPlanReport({
    shadowRequests: [shadowRequest()],
    textures,
    submission: options.passSubmission ?? "deferred",
  });
  const shadowViewProjection = createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest()],
    lights: [light()],
    shadowPassPlan,
    computation: options.matrixComputation ?? "deferred",
  });
  const shadowMatrices = createDirectionalShadowMatrixComputationReport({
    viewProjection: shadowViewProjection,
    transforms: identityTransform(),
  });
  const shadowMatrixDescriptor = createShadowMatrixBufferDescriptorReport({
    viewProjection: shadowViewProjection,
    upload: options.matrixUpload ?? "deferred",
  });
  const casterDrawList = createShadowCasterDrawListPlanReport({
    shadowRequests: [shadowRequest()],
    meshDraws: [meshDraw()],
    shadowPassPlan,
    commandEncoding: options.drawListEncoding ?? "deferred",
  });
  const commandPlan = createShadowCasterCommandPlanReadinessReport({
    shadowPassPlan,
    viewProjection: shadowViewProjection,
    matrixBuffer: shadowMatrixDescriptor,
    casterDrawList,
    commandEncoding: options.commandPlanEncoding ?? "deferred",
  });

  return {
    shadowPassPlan,
    depthTextureResources: createShadowDepthTextureResourceReport({
      device: textureDevice(),
      textures,
    }),
    matrixBufferResource: createShadowMatrixBufferResourceReport({
      device: bufferDevice(),
      descriptor: shadowMatrixDescriptor,
      matrices: shadowMatrices,
    }),
    casterDrawList,
    commandPlan,
    shadowPassPlanToTextures: textures,
    shadowViewProjection,
    shadowMatrices,
    shadowMatrixDescriptor,
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
    intensity: 2,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function meshDraw(): MeshDrawPacket {
  return {
    renderId: 101,
    entity: { index: 101, generation: 0 },
    mesh: createMeshHandle("mesh:caster"),
    material: createMaterialHandle("material:caster"),
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
      materialKey: "material:caster",
      meshKey: "mesh:caster",
      depth: 0,
      stableId: 101,
    },
    batchKey: {
      pipelineKey: "standard",
      materialKey: "material:caster",
      meshLayoutKey: "mesh:caster",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function textureDevice(): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => ({
      descriptor,
      createView: (viewDescriptor?: unknown) => ({ viewDescriptor }),
    }),
  };
}

function bufferDevice(): WebGpuBufferDeviceLike {
  return {
    createBuffer: (descriptor) => ({ descriptor }),
    queue: {
      writeBuffer: () => {},
    },
  };
}
