import { describe, expect, it } from "vitest";

import {
  createFrameReport,
  type DrawPackageBatchingReport,
  type FrameAssemblyReadinessReport,
  type RenderResourceSummaryReport,
} from "@aperture-engine/webgpu";

describe("frame report", () => {
  it("combines ready frame counts", () => {
    expect(
      createFrameReport({
        frame: 7,
        readiness: readiness(true),
        resources: resources(),
        batching: batching(3, 2),
      }),
    ).toMatchObject({
      frame: 7,
      ready: true,
      draws: 3,
      batches: 2,
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
      },
    });
  });

  it("combines blocked frame diagnostics", () => {
    const report = createFrameReport({
      frame: 1,
      readiness: readiness(false, [
        { code: "ready.warn", message: "warn", severity: "warning" },
      ]),
      resources: resources([
        { code: "resource.error", message: "error", severity: "error" },
      ]),
      batching: batching(1, 1),
    });

    expect(report.ready).toBe(false);
    expect(report.diagnostics).toMatchObject({
      total: 2,
      bySeverity: { info: 0, warning: 1, error: 1 },
      byCode: { "ready.warn": 1, "resource.error": 1 },
    });
  });

  it("reports empty frames with info diagnostics", () => {
    const report = createFrameReport({
      frame: 2,
      readiness: readiness(false),
      resources: resources(),
      batching: batching(0, 0, [
        {
          code: "drawBatching.emptyPackages",
          message: "empty",
          severity: "info",
        },
      ]),
    });

    expect(report.draws).toBe(0);
    expect(report.batches).toBe(0);
    expect(report.diagnostics.bySeverity.info).toBe(1);
  });
});

function readiness(
  ready: boolean,
  diagnostics: FrameAssemblyReadinessReport["diagnostics"] = [],
): FrameAssemblyReadinessReport {
  return {
    ready,
    diagnostics,
    counts: {
      drawPackages: 0,
      viewUniforms: 0,
      meshResourcesReady: 0,
      materialResourcesReady: 0,
      pipelineHits: 0,
      pipelineMisses: 0,
      blocked: ready ? 0 : 1,
      warnings: 0,
      errors: 0,
    },
  };
}

function resources(
  diagnostics: RenderResourceSummaryReport["diagnostics"] = [],
): RenderResourceSummaryReport {
  return {
    diagnostics,
    counts: {
      meshResources: 0,
      meshVertexBuffers: 0,
      meshIndexBuffers: 0,
      materialBuffers: 0,
      textures: 0,
      samplers: 0,
      lightBuffers: 0,
      lightGpuBuffers: 0,
      lightBindGroups: 0,
      environmentMaps: 0,
      viewUniformBuffers: 0,
      shaderModules: 0,
      pipelineHits: 0,
      pipelineMisses: 0,
      warnings: 0,
      errors: 0,
    },
  };
}

function batching(
  drawCount: number,
  batchCount: number,
  diagnostics: DrawPackageBatchingReport["diagnostics"] = [],
): DrawPackageBatchingReport {
  return {
    drawCount,
    batchCount,
    diagnostics,
    groups: [],
  };
}
