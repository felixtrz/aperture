import { describe, expect, it } from "vitest";

import {
  createRendererAssemblySmokeReport,
  createRenderResourceSummaryReport,
  createSnapshotLightBindGroupResources,
  rendererAssemblySmokeReportToJson,
  rendererAssemblySmokeReportToJsonValue,
  snapshotLightBindGroupResourcesToSummaryInput,
  type DrawPackageBatchingReport,
  type FrameAssemblyReadinessReport,
  type FrameReport,
  type LightPacket,
  type RenderPackageInspectionReport,
  type RenderSnapshot,
  type RenderResourceSummaryReport,
  type RenderSnapshotCloneabilityResult,
  type RenderSnapshotInspectionReport,
  type SnapshotLightBindGroupDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("renderer assembly smoke JSON helpers", () => {
  it("creates JSON-safe values for ready renderer assembly reports", () => {
    const report = createRendererAssemblySmokeReport(assembledInput());

    expect(rendererAssemblySmokeReportToJsonValue(report)).toMatchObject({
      ready: true,
      sections: {
        snapshot: { present: true, ready: true, diagnosticCodes: [] },
        cloneability: { present: true, ready: true, diagnosticCodes: [] },
        packages: { present: true, ready: true, diagnosticCodes: [] },
        resources: { present: true, ready: true, diagnosticCodes: [] },
        frame: { present: true, ready: true, diagnosticCodes: [] },
      },
      summary: {
        snapshot: { views: 1, meshDraws: 1 },
        cloneability: {
          valid: true,
          diagnostics: {
            total: 0,
            bySeverity: { info: 0, warning: 0, error: 0 },
            byCode: {},
          },
        },
        packages: {
          packageCount: 1,
          diagnostics: {
            total: 0,
            bySeverity: { info: 0, warning: 0, error: 0 },
            byCode: {},
          },
        },
        resources: {
          meshResources: 1,
          meshVertexBuffers: 1,
          meshIndexBuffers: 1,
          materialBuffers: 1,
          lightGpuBuffers: 1,
          lightBindGroups: 1,
          viewUniformBuffers: 1,
          shaderModules: 1,
          pipelineMisses: 1,
        },
        frame: { frame: 1, ready: true, draws: 1, batches: 1 },
      },
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("reports missing sections and source diagnostics", () => {
    const report = rendererAssemblySmokeReportToJsonValue(
      createRendererAssemblySmokeReport({
        ...assembledInput(),
        snapshot: null,
        packages: packages(0),
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.sections.snapshot).toMatchObject({
      present: false,
      ready: false,
      diagnosticCodes: ["rendererAssembly.missingSnapshotInspection"],
    });
    expect(report.sections.packages).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["rendererAssembly.missingPackages"],
    });
    expect(report.diagnostics.byCode).toMatchObject({
      "rendererAssembly.missingSnapshotInspection": 1,
      "rendererAssembly.missingPackages": 1,
    });
  });

  it("serializes stable output without detailed package or handle payloads", () => {
    const report = createRendererAssemblySmokeReport(assembledInput());
    const json = rendererAssemblySmokeReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      rendererAssemblySmokeReportToJsonValue(report),
    );
    expect(json).toBe(rendererAssemblySmokeReportToJson(report));
    expect(json).not.toContain("mesh-buffer:Cube");
    expect(json).not.toContain("material-buffer:White");
    expect(json).not.toContain("unlit|white|p3|triangle-list");
    expect(json).not.toContain("mesh:cube");
    expect(json).not.toContain("raw-snapshot-light-buffer");
    expect(json).not.toContain("raw-snapshot-light-layout");
    expect(json).not.toContain("raw-snapshot-light-bind-group");
    expect(json).toContain('"lightGpuBuffers":1');
    expect(json).toContain('"lightBindGroups":1');
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
      lights: 0,
      environments: 0,
      shadowRequests: 0,
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

function resources(): RenderResourceSummaryReport {
  const snapshotLightResources = createSnapshotLightBindGroupResources(
    renderSnapshot([light("directional", 1)]),
    {
      device: snapshotLightDevice(),
      lightBuffer: { resourceKey: "light-buffer:Main" },
    },
  );

  return createRenderResourceSummaryReport({
    meshResources: [
      {
        valid: true,
        resource: {
          resourceKey: "mesh-buffer:Cube",
          vertexCount: 3,
          vertexBuffers: [
            {
              streamId: "main",
              resourceKey: "mesh-buffer:Cube/vertex:main",
              buffer: { handle: "raw-vertex-buffer" },
              vertexCount: 3,
            },
          ],
          indexBuffer: {
            resourceKey: "mesh-buffer:Cube/index",
            buffer: { handle: "raw-index-buffer" },
            format: "uint16",
            indexCount: 3,
          },
        },
        diagnostics: [],
      },
    ],
    materialResources: [
      {
        valid: true,
        resource: null,
        diagnostics: [],
      },
    ],
    viewUniformResources: [
      {
        valid: true,
        resource: null,
        diagnostics: [],
      },
    ],
    shaderResources: [
      {
        valid: true,
        resource: null,
        diagnostics: [],
      },
    ],
    pipelines: [
      {
        ok: true,
        status: "miss",
        key: "unlit|white|p3|triangle-list",
        pipeline: { handle: "raw-pipeline" },
        diagnostics: [],
      },
    ],
    ...snapshotLightBindGroupResourcesToSummaryInput(snapshotLightResources),
  });
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

function renderSnapshot(lights: readonly LightPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights,
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: lights.length,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function light(kind: LightPacket["kind"], seed: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind,
    color: [1, 1, 1, 1],
    intensity: seed,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 16 * seed,
    layerMask: 1,
  };
}

function snapshotLightDevice(): SnapshotLightBindGroupDeviceLike {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: () => ({ handle: "raw-snapshot-light-buffer" }),
    createBindGroupLayout: () => ({
      handle: "raw-snapshot-light-layout",
    }),
    createBindGroup: () => ({
      handle: "raw-snapshot-light-bind-group",
    }),
  };
}
