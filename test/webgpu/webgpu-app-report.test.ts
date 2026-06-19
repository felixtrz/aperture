import type {
  RenderSnapshot,
  RenderSnapshotChangeSet,
  RenderSnapshotFamilyChangeCounts,
} from "@aperture-engine/render";
import { describe, expect, it } from "vitest";
import {
  renderReport,
  webGpuAppRenderReportToJsonValue,
} from "../../packages/webgpu/src/app/report.js";

describe("WebGPU app report serialization", () => {
  it("keeps full render change-set keys for explicit reports and compacts status keys", () => {
    const report = renderReport({
      ok: true,
      snapshot: emptySnapshot(2),
      snapshotChangeSet: changeSetWithKeys(),
      diagnostics: [],
    });
    const full = webGpuAppRenderReportToJsonValue(report) as Record<
      string,
      any
    >;
    const status = webGpuAppRenderReportToJsonValue(report, {
      detail: "status",
    }) as Record<string, any>;

    expect(
      full.renderChangeSet?.["keys"]?.["meshDraws"]?.["unchanged"],
    ).toEqual([
      "mesh-draw:0",
      "mesh-draw:1",
      "mesh-draw:2",
      "mesh-draw:3",
      "mesh-draw:4",
      "mesh-draw:5",
      "mesh-draw:6",
      "mesh-draw:7",
      "mesh-draw:8",
      "mesh-draw:9",
    ]);
    expect(
      status.renderChangeSet?.["keys"]?.["meshDraws"]?.["unchanged"],
    ).toEqual({
      count: 10,
      sample: [
        "mesh-draw:0",
        "mesh-draw:1",
        "mesh-draw:2",
        "mesh-draw:3",
        "mesh-draw:4",
        "mesh-draw:5",
        "mesh-draw:6",
        "mesh-draw:7",
      ],
      omitted: 2,
    });
    expect(status.renderChangeSet?.["meshDraws"]).toEqual({
      changed: 1,
      unchanged: 10,
      removed: 0,
    });
  });

  it("compacts heavy shadow and diagnostics summary fields for status reports", () => {
    const report = renderReport({
      ok: true,
      snapshot: emptySnapshot(3),
      diagnostics: [],
      diagnosticsSummary: diagnosticsSummaryWithDirectLighting() as never,
      shadow: shadowReportWithDetails() as never,
    });
    const full = webGpuAppRenderReportToJsonValue(report) as Record<
      string,
      any
    >;
    const status = webGpuAppRenderReportToJsonValue(report, {
      detail: "status",
    }) as Record<string, any>;

    expect(full.shadow?.["matrixComputation"]?.["matrices"]).toHaveLength(1);
    expect(
      full.shadow?.["casterDrawList"]?.["lists"]?.[0]?.["drawSample"],
    ).toHaveLength(8);
    expect(status.shadow?.["matrixComputation"]).not.toHaveProperty("matrices");
    expect(status.shadow?.["casterDrawList"]).toMatchObject({
      includedDrawCount: 9,
      diagnosticCount: 0,
    });
    expect(status.shadow?.["casterDrawList"]).not.toHaveProperty("lists");
    expect(
      full.diagnosticsSummary?.["directLighting"]?.["shaderMetadata"]?.[
        "diagnostics"
      ],
    ).toHaveLength(1);
    expect(
      status.diagnosticsSummary?.["directLighting"]?.["shaderMetadata"],
    ).toEqual({
      valid: false,
      diagnosticCount: 1,
    });
    expect(
      status.diagnosticsSummary?.["directLighting"]?.["resources"],
    ).toEqual({
      lightGpuBuffer: true,
      lightBindGroupLayout: true,
      lightBindGroup: true,
    });
    expect(status.diagnosticsSummary?.["directLighting"]).not.toHaveProperty(
      "diagnostics",
    );
  });
});

const noChanges: RenderSnapshotFamilyChangeCounts = {
  changed: 0,
  unchanged: 0,
  removed: 0,
};

function changeSetWithKeys(): RenderSnapshotChangeSet {
  const meshUnchanged = Array.from(
    { length: 10 },
    (_, index) => `mesh-draw:${index}`,
  );

  return {
    previousFrame: 1,
    frame: 2,
    views: noChanges,
    meshDraws: {
      changed: 1,
      unchanged: meshUnchanged.length,
      removed: 0,
    },
    shadowCasterDraws: noChanges,
    lights: noChanges,
    environments: noChanges,
    shadowRequests: noChanges,
    bounds: {
      changed: 0,
      unchanged: 1,
      removed: 0,
    },
    total: {
      changed: 1,
      unchanged: meshUnchanged.length + 1,
      removed: 0,
    },
    keys: {
      views: emptyKeys(),
      meshDraws: {
        changed: ["mesh-draw:changed"],
        unchanged: meshUnchanged,
        removed: [],
      },
      shadowCasterDraws: emptyKeys(),
      lights: emptyKeys(),
      environments: emptyKeys(),
      shadowRequests: emptyKeys(),
      bounds: {
        changed: [],
        unchanged: ["bounds:12:1"],
        removed: [],
      },
    },
  };
}

function emptyKeys(): {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly removed: readonly string[];
} {
  return {
    changed: [],
    unchanged: [],
    removed: [],
  };
}

function diagnosticsSummaryWithDirectLighting(): unknown {
  return {
    sectionCount: 1,
    directLighting: {
      ready: false,
      lightCounts: {
        total: 1,
        direct: 1,
        ambient: 0,
        directional: 1,
        point: 0,
        spot: 0,
        rectArea: 0,
        environment: 0,
        areaShapes: {
          rect: 0,
          disk: 0,
          sphere: 0,
        },
      },
      sections: {
        lightGpuBuffers: true,
        lightBindGroupLayout: true,
        lightBindGroup: true,
        shaderMetadata: false,
      },
      resources: {
        lightGpuBufferResourceKey: "light-buffer",
        lightBindGroupLayoutKey: "light-layout",
        lightBindGroupResourceKey: "light-bind-group",
      },
      shaderMetadata: {
        valid: false,
        diagnostics: [
          {
            code: "shader.missingBinding",
            severity: "error",
            message: "Missing light binding.",
          },
        ],
      },
      diagnostics: [
        {
          code: "light.notReady",
          severity: "error",
          message: "Light resources are not ready.",
        },
      ],
    },
  };
}

function shadowReportWithDetails(): unknown {
  return {
    ready: true,
    status: "ready",
    shadowKind: "directional",
    requestCount: 1,
    passCount: 1,
    drawCalls: 2,
    descriptor: {
      ready: true,
      requestCount: 1,
      descriptorCount: 1,
      sections: {
        shadowRequests: true,
        shadowMapDescriptors: true,
        shadowPassSubmission: false,
      },
      descriptors: [{ shadowId: 1, mapSize: 1024 }],
      diagnostics: [],
    },
    viewProjection: {
      ready: true,
      status: "ready",
      requestCount: 1,
      passCount: 1,
      planCount: 1,
      sections: {
        shadowRequests: true,
        lightPackets: true,
        passPlans: true,
        matrixPlanning: true,
        gpuResources: false,
      },
      plans: [{ shadowId: 1, planKey: "shadow-plan" }],
      diagnostics: [],
    },
    matrixComputation: {
      ready: true,
      status: "ready",
      planCount: 1,
      matrixCount: 1,
      sections: {
        viewProjectionPlanning: true,
        transformData: true,
        matrixComputation: true,
        gpuBufferAllocation: false,
        upload: false,
        passSubmission: false,
      },
      matrices: [{ matrixKey: "shadow-matrix", viewProjectionMatrix: [1] }],
      diagnostics: [],
    },
    casterDrawList: {
      ready: true,
      status: "ready",
      requestCount: 1,
      meshDrawCount: 9,
      listCount: 1,
      includedDrawCount: 9,
      skippedDrawCount: 0,
      sections: {
        shadowRequests: true,
        passPlans: true,
        casterFiltering: true,
        commandEncoding: true,
      },
      lists: [
        {
          shadowId: 1,
          lightId: 1,
          passKey: "shadow-pass",
          casterLayerMask: -1,
          receiverLayerMask: -1,
          includedDrawCount: 9,
          skippedDrawCount: 0,
          commandEncoding: "ready",
          draws: Array.from({ length: 9 }, (_, index) => ({
            renderId: index,
            meshKey: `mesh:${index}`,
            materialKey: "material",
            meshLayoutKey: "POSITION",
            casterCullMode: "front",
            submesh: 0,
          })),
        },
      ],
      diagnostics: [],
    },
    depthTextureKeys: ["shadow-depth"],
    matrixBufferResourceKey: "shadow-matrix-buffer",
    sections: {
      shadowRequests: true,
      depthTextureResources: true,
      matrixBufferResource: true,
      samplerResource: true,
      pipelineResource: true,
      matrixBindGroupResource: true,
      commandBufferSubmission: false,
      receiverResources: true,
    },
    resourceReuse: {
      depthTexturesCreated: 0,
      depthTexturesReused: 1,
      matrixBuffersCreated: 0,
      matrixBuffersReused: 1,
      samplersCreated: 0,
      samplersReused: 1,
      pipelinesCreated: 0,
      pipelinesReused: 1,
      matrixBindGroupsCreated: 0,
      matrixBindGroupsReused: 1,
    },
    commandBufferSubmission: {
      status: "ready",
      assembledPasses: 1,
      commandBuffers: 0,
      submittedCommandBuffers: 0,
      commandBufferKeys: ["shadow-command"],
      sections: {
        encoderAssembly: false,
        commandBufferFinish: false,
        queueSubmission: false,
        shaderSampling: false,
      },
    },
    diagnostics: [],
  };
}

function emptySnapshot(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      fogs: 0,
      shadowRequests: 0,
      bounds: 0,
      quadBatches: 0,
      quadInstances: 0,
      diagnostics: 0,
    },
  };
}
