import { describe, expect, it } from "vitest";

import {
  createShadowCasterFrameResourceReadinessReport,
  shadowCasterFrameResourceReadinessReportToJson,
  shadowCasterFrameResourceReadinessReportToJsonValue,
  type ShadowCasterDrawListPlanReport,
  type ShadowCasterPipelineDescriptorReport,
  type ShadowMatrixBufferResourceReport,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster frame-resource readiness", () => {
  it("reports JSON-safe prepared mesh, matrix, and pipeline resources per caster draw", () => {
    const report = createShadowCasterFrameResourceReadinessReport({
      casterDrawList: casterDrawList("ready"),
      preparedMeshes: [
        {
          meshKey: "mesh:cube",
          meshResourceKey: "gpu-mesh:cube",
          vertexBufferResourceKeys: ["gpu-mesh:cube/position"],
          indexBufferResourceKey: "gpu-mesh:cube/index",
        },
      ],
      matrixBufferResource: matrixBufferResource("available"),
      pipelineDescriptor: pipelineDescriptor("ready"),
    });
    const json = shadowCasterFrameResourceReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "ready",
      counts: {
        casterDraws: 1,
        readyDraws: 1,
        missingMeshBuffers: 0,
        pipelineDescriptors: 1,
        matrixBuffers: 1,
      },
      sections: {
        casterDrawLists: true,
        preparedMeshBuffers: true,
        matrixBufferResource: true,
        pipelineDescriptor: true,
        pipelineCreation: false,
        passSubmission: false,
        shaderSampling: false,
      },
      records: [
        {
          renderId: 101,
          meshKey: "mesh:cube",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
          passKey: "shadow-pass:7:light:11",
          meshResourceKey: "gpu-mesh:cube",
          vertexBufferResourceKeys: ["gpu-mesh:cube/position"],
          indexBufferResourceKey: "gpu-mesh:cube/index",
          matrixResourceKey: "shadow-matrix-buffer:directional",
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/none",
          ready: true,
        },
      ],
      diagnostics: [
        {
          code: "shadowCasterFrameResource.pipelineCreationDeferred",
          severity: "warning",
          message:
            "Shadow caster frame resources have pipeline descriptor metadata, but live pipeline creation is deferred.",
        },
        {
          code: "shadowCasterFrameResource.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow caster frame resources are planned, but shadow pass submission is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCasterFrameResourceReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUBuffer|GPURenderPipeline|GPUCommandEncoder|"raw"|callback/,
    );
  });

  it("preserves deferred pipeline status without requiring live pipeline handles", () => {
    const json = shadowCasterFrameResourceReadinessReportToJsonValue(
      createShadowCasterFrameResourceReadinessReport({
        casterDrawList: casterDrawList("deferred"),
        preparedMeshes: [
          {
            meshKey: "mesh:cube",
            meshResourceKey: "gpu-mesh:cube",
            vertexBufferResourceKeys: ["gpu-mesh:cube/position"],
            indexBufferResourceKey: "gpu-mesh:cube/index",
          },
        ],
        matrixBufferResource: matrixBufferResource("available"),
        pipelineDescriptor: pipelineDescriptor("deferred"),
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "deferred",
      counts: {
        casterDraws: 1,
        readyDraws: 1,
        missingMeshBuffers: 0,
        pipelineDescriptors: 1,
        matrixBuffers: 1,
      },
      sections: {
        preparedMeshBuffers: true,
        matrixBufferResource: true,
        pipelineDescriptor: true,
        pipelineCreation: false,
        passSubmission: false,
      },
    });
  });

  it("selects layout-specialized pipeline descriptors per caster draw", () => {
    const json = shadowCasterFrameResourceReadinessReportToJsonValue(
      createShadowCasterFrameResourceReadinessReport({
        casterDrawList: casterDrawList("ready"),
        preparedMeshes: [
          {
            meshKey: "mesh:cube",
            meshResourceKey: "gpu-mesh:cube",
            vertexBufferResourceKeys: ["gpu-mesh:cube/source-view-0"],
            indexBufferResourceKey: "gpu-mesh:cube/index",
          },
        ],
        matrixBufferResource: matrixBufferResource("available"),
        pipelineDescriptor: pipelineDescriptor("ready", {
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
        }),
      }),
    );

    expect(json.records).toMatchObject([
      {
        renderId: 101,
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
        pipelineKey:
          "shadow-caster/depth-only/depth24plus/triangle-list/none/mesh-layout:POSITION%2CNORMAL%2CTEXCOORD_0",
        ready: true,
      },
    ]);
  });

  it("reports missing prepared mesh and matrix resources as blocking", () => {
    const json = shadowCasterFrameResourceReadinessReportToJsonValue(
      createShadowCasterFrameResourceReadinessReport({
        casterDrawList: casterDrawList("ready"),
        preparedMeshes: [],
        matrixBufferResource: matrixBufferResource("missing"),
        pipelineDescriptor: pipelineDescriptor("ready"),
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        casterDraws: 1,
        readyDraws: 0,
        missingMeshBuffers: 1,
        pipelineDescriptors: 1,
        matrixBuffers: 0,
      },
      records: [
        {
          renderId: 101,
          meshKey: "mesh:cube",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
          meshResourceKey: null,
          indexBufferResourceKey: null,
          matrixResourceKey: null,
          ready: false,
        },
      ],
    });
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterFrameResource.missingMatrixBuffer",
      "shadowCasterFrameResource.missingPreparedMesh",
      "shadowCasterFrameResource.pipelineCreationDeferred",
      "shadowCasterFrameResource.passSubmissionDeferred",
    ]);
  });

  it("reports not-required when no shadow caster draw lists are needed", () => {
    const json = shadowCasterFrameResourceReadinessReportToJsonValue(
      createShadowCasterFrameResourceReadinessReport({
        casterDrawList: casterDrawList("not-required"),
        preparedMeshes: [],
        matrixBufferResource: matrixBufferResource("not-required"),
        pipelineDescriptor: pipelineDescriptor("not-required"),
      }),
    );

    expect(json).toMatchObject({
      ready: true,
      status: "not-required",
      counts: {
        casterDraws: 0,
        readyDraws: 0,
        missingMeshBuffers: 0,
        pipelineDescriptors: 0,
        matrixBuffers: 0,
      },
      records: [],
      diagnostics: [],
    });
  });
});

function casterDrawList(
  status: ShadowCasterDrawListPlanReport["status"],
): ShadowCasterDrawListPlanReport {
  const hasDraws = status !== "not-required";

  return {
    ready: status === "ready" || status === "not-required",
    status,
    requestCount: hasDraws ? 1 : 0,
    meshDrawCount: hasDraws ? 1 : 0,
    listCount: hasDraws ? 1 : 0,
    includedDrawCount: hasDraws ? 1 : 0,
    skippedDrawCount: 0,
    sections: {
      shadowRequests: true,
      passPlans: true,
      casterFiltering: true,
      commandEncoding: status === "ready",
    },
    lists: hasDraws
      ? [
          {
            shadowId: 7,
            lightId: 11,
            passKey: "shadow-pass:7:light:11",
            casterLayerMask: 1,
            receiverLayerMask: 1,
            includedDrawCount: 1,
            skippedDrawCount: 0,
            commandEncoding: status === "ready" ? "ready" : "deferred",
            draws: [
              {
                renderId: 101,
                meshKey: "mesh:cube",
                materialKey: "material:standard",
                meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
                casterCullMode: "none",
                submesh: 0,
                layerMask: 1,
                worldTransformOffset: 0,
              },
            ],
          },
        ]
      : [],
    diagnostics: [],
  };
}

function matrixBufferResource(
  status: ShadowMatrixBufferResourceReport["status"],
): ShadowMatrixBufferResourceReport {
  const available = status === "available";

  return {
    ready: status === "available" || status === "not-required",
    status,
    matrixCount: available ? 1 : 0,
    byteSize: available ? 64 : 0,
    createdBufferCount: available ? 1 : 0,
    reusedBufferCount: 0,
    sections: {
      matrixComputation: true,
      bufferDescriptor: available,
      bufferAllocation: available,
      upload: available,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: available
      ? {
          resourceKey: "shadow-matrix-buffer:directional",
          label: "DirectionalShadowMatrices",
          buffer: {},
          byteSize: 64,
          matrixCount: 1,
          entryMatrixKeys: ["shadow-matrix:7:light:11"],
        }
      : null,
    diagnostics: [],
  };
}

function pipelineDescriptor(
  status: ShadowCasterPipelineDescriptorReport["status"],
  options: {
    readonly meshLayoutKey?: string | null;
  } = {},
): ShadowCasterPipelineDescriptorReport {
  const hasDescriptor = status !== "missing" && status !== "not-required";
  const meshLayoutKey = options.meshLayoutKey ?? null;
  const pipelineKey =
    meshLayoutKey === null
      ? "shadow-caster/depth-only/depth24plus/triangle-list/none"
      : `shadow-caster/depth-only/depth24plus/triangle-list/none/mesh-layout:${encodeURIComponent(meshLayoutKey)}`;
  const descriptor = hasDescriptor
    ? {
        pipelineKey,
        label:
          meshLayoutKey === null
            ? "shadow-caster-depth-only:depth24plus:triangle-list"
            : `shadow-caster-depth-only:depth24plus:triangle-list:${meshLayoutKey}`,
        shader: {
          family: "shadow-caster" as const,
          label: "shadow-caster-depth-only" as const,
          entryPoints: {
            vertex: "vs_main" as const,
            fragment: "fs_main" as const,
          },
        },
        vertex: {
          buffers: ["POSITION"] as const,
          meshLayoutKey,
          matrixBufferLayoutKey:
            "shadow-caster/group-0:directional-shadow-matrices@0" as const,
        },
        index: {
          required: true as const,
          format: "uint32" as const,
        },
        primitive: {
          topology: "triangle-list" as const,
          cullMode: "none" as const,
          frontFace: "ccw" as const,
        },
        depthStencil: {
          format: "depth24plus" as const,
          depthWriteEnabled: true as const,
          depthCompare: "less-equal" as const,
          depthBias: 0,
          depthBiasSlopeScale: 0,
        },
        colorTargets: [] as const,
      }
    : null;

  return {
    ready: status === "ready" || status === "not-required",
    status,
    commandRecordCount: hasDescriptor ? 1 : 0,
    descriptorCount: hasDescriptor ? 1 : 0,
    sections: {
      commandEncoding: hasDescriptor,
      vertexBufferLayout: hasDescriptor,
      indexBuffer: hasDescriptor,
      matrixBufferLayout: hasDescriptor,
      depthStencil: hasDescriptor,
      colorTargets: true,
      pipelineCreation: false,
      passSubmission: false,
      shaderSampling: false,
    },
    descriptor,
    descriptors: descriptor === null ? [] : [descriptor],
    diagnostics: [],
  };
}
