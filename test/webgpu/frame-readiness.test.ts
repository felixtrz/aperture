import { describe, expect, it } from "vitest";

import {
  createFrameAssemblyReadinessReport,
  type CreateMeshGpuBuffersResult,
  type CreateUnlitMaterialGpuBufferResult,
  type GetOrCreateRenderPipelineResult,
  type PackedSnapshotViewUniforms,
  type RenderWorldDrawPackagePlan,
} from "@aperture-engine/webgpu";
import { PACKED_VIEW_UNIFORM_FLOAT_STRIDE } from "@aperture-engine/core";

describe("frame assembly readiness report", () => {
  it("reports all-ready frame assembly inputs", () => {
    const report = createFrameAssemblyReadinessReport({
      drawPackages: drawPackages(1),
      viewUniforms: viewUniforms(1),
      meshResources: [meshResource(true)],
      materialResources: [materialResource(true)],
      pipelines: [pipeline("hit")],
    });

    expect(report.ready).toBe(true);
    expect(report.counts).toMatchObject({
      drawPackages: 1,
      viewUniforms: 1,
      meshResourcesReady: 1,
      materialResourcesReady: 1,
      pipelineHits: 1,
      pipelineMisses: 0,
      blocked: 0,
      warnings: 0,
      errors: 0,
    });
  });

  it("reports missing mesh and material resources as blocked warnings", () => {
    const report = createFrameAssemblyReadinessReport({
      drawPackages: drawPackages(1),
      viewUniforms: viewUniforms(1),
      meshResources: [meshResource(false)],
      materialResources: [materialResource(false)],
      pipelines: [pipeline("miss")],
    });

    expect(report.ready).toBe(false);
    expect(report.counts).toMatchObject({
      pipelineMisses: 1,
      blocked: 2,
      warnings: 2,
      errors: 0,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "meshGpuBuffer.vertexCreationFailed",
      "unlitMaterialGpuBuffer.creationFailed",
    ]);
  });

  it("reports pipeline failures as errors", () => {
    const report = createFrameAssemblyReadinessReport({
      drawPackages: drawPackages(1),
      viewUniforms: viewUniforms(1),
      meshResources: [meshResource(true)],
      materialResources: [materialResource(true)],
      pipelines: [pipelineFailure()],
    });

    expect(report.ready).toBe(false);
    expect(report.counts).toMatchObject({ blocked: 1, errors: 1 });
    expect(report.diagnostics).toMatchObject([
      {
        code: "pipelineCacheIntegration.pipelineCreationFailed",
        severity: "error",
      },
    ]);
  });

  it("reports empty frame inputs", () => {
    const report = createFrameAssemblyReadinessReport({
      drawPackages: drawPackages(0),
      viewUniforms: {
        data: new Float32Array(0),
        views: [],
        diagnostics: [
          {
            code: "viewUniform.emptySnapshot",
            message: "Render snapshot has no views to pack.",
          },
        ],
      },
      meshResources: [],
      materialResources: [],
      pipelines: [],
    });

    expect(report.ready).toBe(false);
    expect(report.counts).toMatchObject({
      drawPackages: 0,
      viewUniforms: 0,
      warnings: 0,
      errors: 0,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewUniform.emptySnapshot",
      "frameReadiness.emptyFrame",
    ]);
  });
});

function drawPackages(count: number): RenderWorldDrawPackagePlan {
  return {
    packages: Array.from({ length: count }, (_, index) => ({
      renderId: index + 1,
    })) as unknown as RenderWorldDrawPackagePlan["packages"],
    diagnostics: [],
    summary: {
      readyDrawCount: count,
      blockedDrawCount: 0,
      packageCount: count,
      packagePoolSize: count,
      packagePoolSizeBeforeWrite: count,
      packageSlotsReused: count,
      packageSlotsCreated: 0,
      missingPackedTransformCount: 0,
      diagnostics: { total: 0, byCode: {} },
    },
  };
}

function viewUniforms(count: number): PackedSnapshotViewUniforms {
  return {
    data: new Float32Array(count * PACKED_VIEW_UNIFORM_FLOAT_STRIDE),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index,
      sourceOffset: index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
      packedOffset: index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
    })),
    diagnostics: [],
  };
}

function meshResource(valid: boolean): CreateMeshGpuBuffersResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "meshGpuBuffer.vertexCreationFailed",
            message: "failed",
          },
        ],
      };
}

function materialResource(valid: boolean): CreateUnlitMaterialGpuBufferResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "unlitMaterialGpuBuffer.creationFailed",
            message: "failed",
          },
        ],
      };
}

function pipeline(status: "hit" | "miss"): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status,
    key: status,
    pipeline: {},
    diagnostics: [],
  };
}

function pipelineFailure(): GetOrCreateRenderPipelineResult {
  return {
    ok: false,
    reason: "create-render-pipeline-unavailable",
    diagnostics: [
      {
        code: "pipelineCacheIntegration.pipelineCreationFailed",
        message: "failed",
      },
    ],
  };
}
