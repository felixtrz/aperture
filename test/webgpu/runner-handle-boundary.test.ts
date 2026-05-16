import { describe, expect, it } from "vitest";

import {
  createRendererAssemblySmokeReport,
  frameExecutionReportToJson,
  injectedRenderFrameRunnerReportToJson,
  renderPassAssemblySmokeReportToJson,
  rendererAssemblySmokeReportToJson,
  rendererFrameSummaryReportToJson,
  type InjectedRenderFrameRunnerReport,
  type RendererAssemblySmokeReport,
} from "../../src/index.js";
import { createInjectedRenderFrameSmokeFixture } from "./fixtures/injected-render-frame.js";

describe("runner JSON handle boundaries", () => {
  it("omits raw handles from runner JSON surfaces", () => {
    const fixture = createInjectedRenderFrameSmokeFixture();
    const runner = runnerReport(fixture);
    const jsonValues = [
      renderPassAssemblySmokeReportToJson(fixture.renderPass),
      frameExecutionReportToJson(fixture.frameExecution),
      rendererFrameSummaryReportToJson(fixture.summary),
      injectedRenderFrameRunnerReportToJson(runner),
    ];

    for (const json of jsonValues) {
      expect(json).not.toContain("pipeline-handle");
      expect(json).not.toContain("bind-group-handle");
      expect(json).not.toContain("vertex-buffer-handle");
      expect(json).not.toContain("command-buffer");
      expect(json).toContain("commands");
    }
  });

  it("omits package and snapshot handles from renderer assembly JSON", () => {
    const json = rendererAssemblySmokeReportToJson(rendererWithHandles());

    expect(json).not.toContain("mesh-buffer:Secret");
    expect(json).not.toContain("material-buffer:Secret");
    expect(json).not.toContain("batch:secret");
    expect(json).not.toContain("mesh:secret");
    expect(json).not.toContain("environment-map:secret");
    expect(json).toContain("packageCount");
  });
});

function runnerReport(
  fixture: ReturnType<typeof createInjectedRenderFrameSmokeFixture>,
): InjectedRenderFrameRunnerReport {
  return {
    renderPass: fixture.renderPassRun,
    assembly: fixture.boundary,
    execution: fixture.frameExecution,
    summary: fixture.summary,
    json: fixture.json,
  };
}

function rendererWithHandles(): RendererAssemblySmokeReport {
  return createRendererAssemblySmokeReport({
    snapshot: {
      counts: {
        views: 1,
        meshDraws: 1,
        lights: 0,
        environments: 1,
        shadowRequests: 0,
        bounds: 0,
        transformFloats: 16,
        viewMatrixFloats: 48,
        diagnostics: 0,
      },
      handles: {
        meshKeys: ["mesh:secret"],
        materialKeys: ["material:secret"],
        renderTargetKeys: [],
        environmentMapKeys: ["environment-map:secret"],
      },
      diagnostics: [],
    },
    cloneability: { valid: true, diagnostics: [] },
    packages: {
      packageCount: 1,
      renderIds: [1],
      meshResourceKeys: ["mesh-buffer:Secret"],
      materialResourceKeys: ["material-buffer:Secret"],
      batchKeys: ["batch:secret"],
      transformPackedOffsets: [0],
      diagnostics: [],
    },
    resources: {
      counts: {
        meshResources: 1,
        meshVertexBuffers: 1,
        meshIndexBuffers: 0,
        materialBuffers: 1,
        textures: 0,
        samplers: 0,
        lightBuffers: 0,
        lightGpuBuffers: 0,
        environmentMaps: 0,
        viewUniformBuffers: 1,
        shaderModules: 1,
        pipelineHits: 0,
        pipelineMisses: 1,
        warnings: 0,
        errors: 0,
      },
      diagnostics: [],
    },
    frame: {
      frame: 1,
      ready: true,
      draws: 1,
      batches: 1,
      resources: {
        meshResources: 1,
        meshVertexBuffers: 1,
        meshIndexBuffers: 0,
        materialBuffers: 1,
        textures: 0,
        samplers: 0,
        lightBuffers: 0,
        lightGpuBuffers: 0,
        environmentMaps: 0,
        viewUniformBuffers: 1,
        shaderModules: 1,
        pipelineHits: 0,
        pipelineMisses: 1,
        warnings: 0,
        errors: 0,
      },
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    },
  });
}
