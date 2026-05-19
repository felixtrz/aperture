import { describe, expect, it } from "vitest";

import {
  createShadowCasterFrameResourceReadinessReport,
  shadowCasterFrameResourceReadinessReportToJson,
  shadowCasterFrameResourceReadinessReportToJsonValue,
  type ShadowCasterDrawListPlanReport,
  type ShadowCasterPipelineDescriptorReport,
  type ShadowMatrixBufferResourceReport,
} from "@aperture-engine/webgpu";

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
                submesh: 0,
                layerMask: 1,
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
): ShadowCasterPipelineDescriptorReport {
  const hasDescriptor = status !== "missing" && status !== "not-required";

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
    descriptor: hasDescriptor
      ? {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/none",
          label: "shadow-caster-depth-only:depth24plus:triangle-list",
          shader: {
            family: "shadow-caster",
            label: "shadow-caster-depth-only",
            entryPoints: {
              vertex: "vs_main",
              fragment: "fs_main",
            },
          },
          vertex: {
            buffers: ["POSITION"],
            matrixBufferLayoutKey:
              "shadow-caster/group-0:directional-shadow-matrices@0",
          },
          index: {
            required: true,
            format: "uint32",
          },
          primitive: {
            topology: "triangle-list",
            cullMode: "none",
            frontFace: "ccw",
          },
          depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less-equal",
          },
          colorTargets: [],
        }
      : null,
    diagnostics: [],
  };
}
