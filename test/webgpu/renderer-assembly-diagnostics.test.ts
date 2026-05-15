import { describe, expect, it } from "vitest";

import {
  createRendererAssemblySmokeReport,
  summarizeRendererAssemblyDiagnosticsBySection,
  type DrawPackageBatchingReport,
  type FrameAssemblyReadinessReport,
  type FrameReport,
  type RenderPackageInspectionReport,
  type RenderResourceSummaryReport,
  type RenderSnapshotInspectionReport,
} from "../../src/index.js";

describe("renderer assembly diagnostics by section", () => {
  it("groups missing sections", () => {
    const report = summarizeRendererAssemblyDiagnosticsBySection(
      createRendererAssemblySmokeReport({
        snapshot: null,
        cloneability: null,
        packages: null,
        resources: null,
        frame: null,
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.diagnostics).toMatchObject({
      total: 5,
      bySeverity: { error: 5 },
    });
    expect(report.sections.snapshot.diagnostics.byCode).toMatchObject({
      "rendererAssembly.missingSnapshotInspection": 1,
    });
    expect(report.sections.frame.diagnostics.byCode).toMatchObject({
      "rendererAssembly.missingFrameReport": 1,
    });
  });

  it("groups source diagnostics by renderer assembly section", () => {
    const report = summarizeRendererAssemblyDiagnosticsBySection(
      createRendererAssemblySmokeReport({
        snapshot: snapshot({ views: 0, meshDraws: 0 }),
        cloneability: { valid: false, diagnostics: [] },
        packages: packages(0),
        resources: resources({
          meshResources: 0,
          materialBuffers: 0,
          viewUniformBuffers: 0,
          shaderModules: 0,
          pipelineHits: 0,
          pipelineMisses: 0,
          errors: 1,
        }),
        frame: frame(false),
      }),
    );

    expect(report.sections.snapshot.diagnostics.byCode).toMatchObject({
      "rendererAssembly.missingSnapshotViews": 1,
      "rendererAssembly.missingSnapshotDraws": 1,
    });
    expect(report.sections.cloneability.diagnostics.byCode).toMatchObject({
      "rendererAssembly.snapshotNotCloneable": 1,
    });
    expect(report.sections.resources.diagnostics.byCode).toMatchObject({
      "rendererAssembly.missingResources": 1,
      "rendererAssembly.resourceErrors": 1,
    });
    expect(report.sections.frame.diagnostics.byCode).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const report = summarizeRendererAssemblyDiagnosticsBySection(
      createRendererAssemblySmokeReport({
        snapshot: snapshot({ views: 0 }),
        cloneability: { valid: true, diagnostics: [] },
        packages: packages(1),
        resources: resources(),
        frame: frame(true),
      }),
    );
    const json = JSON.stringify(report);

    expect(json).toBe(JSON.stringify(report));
    expect(json).not.toContain("mesh-buffer:Cube");
    expect(json).not.toContain("material-buffer:White");
  });
});

function snapshot(
  counts: Partial<RenderSnapshotInspectionReport["counts"]> = {},
): RenderSnapshotInspectionReport {
  return {
    counts: {
      views: counts.views ?? 1,
      meshDraws: counts.meshDraws ?? 1,
      lights: counts.lights ?? 0,
      environments: counts.environments ?? 0,
      shadowRequests: counts.shadowRequests ?? 0,
      bounds: counts.bounds ?? 0,
      transformFloats: counts.transformFloats ?? 16,
      viewMatrixFloats: counts.viewMatrixFloats ?? 48,
      diagnostics: counts.diagnostics ?? 0,
    },
    handles: {
      meshKeys: ["mesh:cube"],
      materialKeys: ["material:white"],
      renderTargetKeys: [],
    },
    diagnostics: [],
  };
}

function packages(packageCount: number): RenderPackageInspectionReport {
  return {
    packageCount,
    renderIds: packageCount > 0 ? [1] : [],
    meshResourceKeys: packageCount > 0 ? ["mesh-buffer:Cube"] : [],
    materialResourceKeys: packageCount > 0 ? ["material-buffer:White"] : [],
    batchKeys: packageCount > 0 ? ["unlit|white|p3|triangle-list"] : [],
    transformPackedOffsets: packageCount > 0 ? [0] : [],
    diagnostics: [],
  };
}

function resources(
  counts: Partial<RenderResourceSummaryReport["counts"]> = {},
): RenderResourceSummaryReport {
  return {
    counts: {
      meshResources: counts.meshResources ?? 1,
      meshVertexBuffers: counts.meshVertexBuffers ?? 1,
      meshIndexBuffers: counts.meshIndexBuffers ?? 1,
      materialBuffers: counts.materialBuffers ?? 1,
      viewUniformBuffers: counts.viewUniformBuffers ?? 1,
      shaderModules: counts.shaderModules ?? 1,
      pipelineHits: counts.pipelineHits ?? 0,
      pipelineMisses: counts.pipelineMisses ?? 1,
      warnings: counts.warnings ?? 0,
      errors: counts.errors ?? 0,
    },
    diagnostics: [],
  };
}

function frame(ready: boolean): FrameReport {
  const readiness: FrameAssemblyReadinessReport = {
    ready,
    counts: {
      drawPackages: ready ? 1 : 0,
      viewUniforms: ready ? 1 : 0,
      meshResourcesReady: ready ? 1 : 0,
      materialResourcesReady: ready ? 1 : 0,
      pipelineHits: 0,
      pipelineMisses: ready ? 1 : 0,
      blocked: ready ? 0 : 1,
      warnings: ready ? 0 : 1,
      errors: 0,
    },
    diagnostics: [],
  };
  const batching: DrawPackageBatchingReport = {
    drawCount: ready ? 1 : 0,
    batchCount: ready ? 1 : 0,
    groups: [],
    diagnostics: [],
  };

  return {
    frame: 1,
    ready: readiness.ready,
    draws: batching.drawCount,
    batches: batching.batchCount,
    resources: resources().counts,
    diagnostics: {
      total: ready ? 0 : 1,
      bySeverity: { info: 0, warning: ready ? 0 : 1, error: 0 },
      byCode: ready ? {} : { "rendererAssembly.frameNotReady": 1 },
    },
  };
}
