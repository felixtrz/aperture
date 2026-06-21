import { describe, expect, it } from "vitest";

import {
  createRendererAssemblySmokeReport,
  type DrawPackageBatchingReport,
  type FrameAssemblyReadinessReport,
  type FrameReport,
  type RenderPackageInspectionReport,
  type RenderResourceSummaryReport,
  type RenderSnapshotCloneabilityResult,
  type RenderSnapshotInspectionReport,
} from "@aperture-engine/webgpu/test-support";

describe("renderer assembly smoke report", () => {
  it("reports ready when all renderer data path sections are present", () => {
    const report = createRendererAssemblySmokeReport(assembledInput());

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(
      Object.values(report.sections).every((section) => section.ready),
    ).toBe(true);
    expect(report.summary.snapshot?.meshDraws).toBe(1);
    expect(report.summary.resources?.pipelineMisses).toBe(1);
    expect(report.summary.frame?.draws).toBe(1);
  });

  it("reports a missing snapshot inspection section", () => {
    const report = createRendererAssemblySmokeReport({
      ...assembledInput(),
      snapshot: null,
    });

    expect(report.ready).toBe(false);
    expect(report.sections.snapshot).toMatchObject({
      present: false,
      ready: false,
      diagnosticCodes: ["rendererAssembly.missingSnapshotInspection"],
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "rendererAssembly.missingSnapshotInspection",
        section: "snapshot",
      },
    ]);
  });

  it("reports missing draw packages from a present package inspection", () => {
    const report = createRendererAssemblySmokeReport({
      ...assembledInput(),
      packages: packages(0),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.packages).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["rendererAssembly.missingPackages"],
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "rendererAssembly.missingPackages",
    );
  });

  it("reports missing renderer resources from a present resource summary", () => {
    const report = createRendererAssemblySmokeReport({
      ...assembledInput(),
      resources: resources({
        meshResources: 0,
        materialBuffers: 0,
        viewUniformBuffers: 0,
        shaderModules: 0,
        pipelineMisses: 0,
      }),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.resources).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["rendererAssembly.missingResources"],
    });
    expect(report.diagnostics[0]).toMatchObject({
      code: "rendererAssembly.missingResources",
      section: "resources",
    });
    expect(report.diagnostics[0]?.message).toContain(
      "mesh, material, view, shader, pipeline",
    );
  });
});

function assembledInput(): {
  readonly snapshot: RenderSnapshotInspectionReport;
  readonly cloneability: RenderSnapshotCloneabilityResult;
  readonly packages: RenderPackageInspectionReport;
  readonly resources: RenderResourceSummaryReport;
  readonly frame: FrameReport;
} {
  return {
    snapshot: snapshot(),
    cloneability: { valid: true, diagnostics: [] },
    packages: packages(1),
    resources: resources(),
    frame: frame(),
  };
}

function snapshot(): RenderSnapshotInspectionReport {
  return {
    counts: {
      views: 1,
      meshDraws: 1,
      shadowCasterDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      proceduralSkies: 0,
      runtimeUniforms: 0,
      bounds: 0,
      transformFloats: 16,
      viewMatrixFloats: 48,
      diagnostics: 0,
    },
    handles: {
      meshKeys: ["mesh:cube"],
      materialKeys: ["material:white"],
      renderTargetKeys: [],
      environmentMapKeys: [],
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
      textures: counts.textures ?? 0,
      samplers: counts.samplers ?? 0,
      lightBuffers: counts.lightBuffers ?? 0,
      lightGpuBuffers: counts.lightGpuBuffers ?? 0,
      lightBindGroups: counts.lightBindGroups ?? 0,
      environmentMaps: counts.environmentMaps ?? 0,
      viewUniformBuffers: counts.viewUniformBuffers ?? 1,
      shaderModules: counts.shaderModules ?? 1,
      pipelineHits: counts.pipelineHits ?? 0,
      pipelineMisses: counts.pipelineMisses ?? 1,
      inspectedResources: counts.inspectedResources ?? 0,
      staleResources: counts.staleResources ?? 0,
      missingResources: counts.missingResources ?? 0,
      pendingDestroyResources: counts.pendingDestroyResources ?? 0,
      warnings: counts.warnings ?? 0,
      errors: counts.errors ?? 0,
    },
    diagnostics: [],
  };
}

function frame(): FrameReport {
  const readiness: FrameAssemblyReadinessReport = {
    ready: true,
    counts: {
      drawPackages: 1,
      viewUniforms: 1,
      meshResourcesReady: 1,
      materialResourcesReady: 1,
      pipelineHits: 0,
      pipelineMisses: 1,
      blocked: 0,
      warnings: 0,
      errors: 0,
    },
    diagnostics: [],
  };
  const batching: DrawPackageBatchingReport = {
    drawCount: 1,
    batchCount: 1,
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
      total: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      byCode: {},
    },
  };
}
