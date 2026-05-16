import { describe, expect, it } from "vitest";

import {
  createFrameExecutionReport,
  createRendererFrameSummaryFromExecutionReport,
  type RenderPassAssemblySmokeReport,
  type RendererAssemblySmokeReport,
} from "@aperture-engine/webgpu";
import { createFrameExecutionSmokeFixture } from "./fixtures/frame-execution.js";

describe("renderer frame summary builder from frame execution", () => {
  it("builds a ready renderer frame summary from execution reports", () => {
    const summary = createRendererFrameSummaryFromExecutionReport({
      renderer: renderer(true),
      renderPass: renderPass(true),
      execution: createFrameExecutionReport(
        createFrameExecutionSmokeFixture().assembly,
      ),
    });

    expect(summary.ready).toBe(true);
    expect(
      Object.values(summary.sections).every((section) => section.ready),
    ).toBe(true);
    expect(summary.counts).toMatchObject({
      plannedDraws: 3,
      commands: 1,
      executedCommands: 1,
      submittedCommandBuffers: 1,
      diagnostics: 0,
    });
  });

  it("reports missing execution-derived sections", () => {
    const summary = createRendererFrameSummaryFromExecutionReport({
      renderer: renderer(true),
      renderPass: renderPass(true),
      execution: null,
    });

    expect(summary.ready).toBe(false);
    expect(summary.sections.frameSubmission.present).toBe(false);
    expect(summary.sections.frameBoundary.present).toBe(false);
    expect(summary.sections.mvpFrameReadiness.present).toBe(false);
    expect(summary.sections.commandSubmissionMetrics.present).toBe(false);
    expect(summary.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "rendererFrameSummary.missingFrameSubmission",
      "rendererFrameSummary.missingFrameBoundary",
      "rendererFrameSummary.missingMvpFrameReadiness",
      "rendererFrameSummary.missingCommandSubmissionMetrics",
    ]);
  });

  it("preserves renderer, render-pass, and derived MVP failures", () => {
    const summary = createRendererFrameSummaryFromExecutionReport({
      renderer: renderer(false),
      renderPass: renderPass(false),
      execution: createFrameExecutionReport(
        createFrameExecutionSmokeFixture().assembly,
      ),
    });

    expect(summary.ready).toBe(false);
    expect(summary.sections.rendererAssembly.ready).toBe(false);
    expect(summary.sections.renderPassAssembly.ready).toBe(false);
    expect(summary.sections.mvpFrameReadiness.ready).toBe(false);
    expect(summary.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "rendererAssembly.frameNotReady",
      "renderPassAssembly.commandPlanNotReady",
      "mvpFrameReadiness.rendererAssemblyNotReady",
      "mvpFrameReadiness.renderPassAssemblyNotReady",
    ]);
  });
});

function renderer(ready: boolean): RendererAssemblySmokeReport {
  return {
    ready,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "rendererAssembly.frameNotReady",
            message: "Frame report is not ready.",
            severity: "warning",
            section: "frame",
          },
        ],
    summary: {
      snapshot: null,
      cloneability: null,
      packages: null,
      resources: null,
      frame: {
        frame: 1,
        ready,
        draws: 3,
        batches: 1,
        diagnostics: {
          total: ready ? 0 : 1,
          bySeverity: { info: 0, warning: ready ? 0 : 1, error: 0 },
          byCode: ready ? {} : { "rendererAssembly.frameNotReady": 1 },
        },
      },
    },
  };
}

function renderPass(ready: boolean): RenderPassAssemblySmokeReport {
  return {
    ready,
    sections: {} as RenderPassAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "renderPassAssembly.commandPlanNotReady",
            message: "Command plan is not ready.",
            severity: "warning",
            section: "commands",
          },
        ],
    summary: {
      drawList: { valid: ready, draws: [] },
      resources: { valid: ready, draws: [] },
      commands: {
        valid: ready,
        drawCount: 3,
        commandCount: 3,
        indexedDrawCount: 0,
        nonIndexedDrawCount: 3,
      },
      execution: {
        valid: ready,
        commandCount: 3,
        executedCommands: ready ? 3 : 2,
        skippedCommands: ready ? 0 : 1,
        drawCalls: ready ? 3 : 2,
      },
    },
  };
}
