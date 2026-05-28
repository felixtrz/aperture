import { describe, expect, it } from "vitest";

import {
  createRendererFrameSummaryReport,
  type CommandSubmissionMetricsReport,
  type FrameBoundaryValidationReport,
  type FrameSubmissionSmokeReport,
  type MvpFrameReadinessReport,
  type RenderPassAssemblySmokeReport,
  type RendererAssemblySmokeReport,
} from "@aperture-engine/webgpu/test-support";

describe("renderer frame summary aggregate", () => {
  it("summarizes all-ready frame reports", () => {
    const report = createRendererFrameSummaryReport(readyInput());

    expect(report.ready).toBe(true);
    expect(
      Object.values(report.sections).every((section) => section.ready),
    ).toBe(true);
    expect(report.counts).toEqual({
      plannedDraws: 3,
      drawCalls: 2,
      commands: 4,
      executedCommands: 4,
      skippedCommands: 0,
      commandBuffers: 1,
      submittedCommandBuffers: 1,
      skippedSubmissions: 0,
      diagnostics: 0,
    });
    expect(report.diagnostics).toEqual([]);
    expect(report.diagnosticSummary).toEqual({
      total: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      byCode: {},
    });
  });

  it("marks missing sections without losing fallback counts", () => {
    const report = createRendererFrameSummaryReport({
      ...readyInput(),
      mvp: null,
      commandSubmission: null,
    });

    expect(report.ready).toBe(false);
    expect(report.sections.mvpFrameReadiness).toEqual({
      section: "mvpFrameReadiness",
      present: false,
      ready: false,
      diagnosticCount: 1,
    });
    expect(report.sections.commandSubmissionMetrics).toEqual({
      section: "commandSubmissionMetrics",
      present: false,
      ready: false,
      diagnosticCount: 1,
    });
    expect(report.counts).toMatchObject({
      plannedDraws: 3,
      drawCalls: 2,
      commands: 4,
      commandBuffers: 1,
      submittedCommandBuffers: 1,
      diagnostics: 2,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "rendererFrameSummary.missingMvpFrameReadiness",
      "rendererFrameSummary.missingCommandSubmissionMetrics",
    ]);
  });

  it("preserves mixed source diagnostics with stable section labels", () => {
    const report = createRendererFrameSummaryReport({
      renderer: renderer(false),
      renderPass: renderPass(false),
      submission: submission(false),
      boundary: boundary(false),
      mvp: mvp(false),
      commandSubmission: commandSubmission(false),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.rendererAssembly).toMatchObject({
      present: true,
      ready: false,
      diagnosticCount: 1,
    });
    expect(report.counts).toMatchObject({
      drawCalls: 1,
      executedCommands: 3,
      skippedCommands: 1,
      commandBuffers: 0,
      submittedCommandBuffers: 0,
      skippedSubmissions: 1,
    });
    expect(report.diagnostics).toMatchObject([
      {
        section: "rendererAssembly",
        sourceSection: "snapshot",
        code: "rendererAssembly.missingSnapshotViews",
        severity: "warning",
      },
      {
        section: "renderPassAssembly",
        sourceSection: "commands",
        code: "renderPassAssembly.commandPlanNotReady",
        severity: "warning",
      },
      {
        section: "frameSubmission",
        sourceSection: "submit",
        code: "frameSubmission.submitFailed",
        severity: "error",
      },
      {
        section: "frameBoundary",
        code: "frameBoundaryValidation.diagnosticWarnings",
        severity: "warning",
      },
      {
        section: "mvpFrameReadiness",
        code: "mvpFrameReadiness.frameBoundaryNotReady",
        severity: "warning",
      },
      {
        section: "commandSubmissionMetrics",
        code: "commandSubmissionMetrics.submitFailed",
        severity: "warning",
      },
    ]);
    expect(report.diagnosticSummary.byCode).toMatchObject({
      "rendererAssembly.missingSnapshotViews": 1,
      "renderPassAssembly.commandPlanNotReady": 1,
      "frameSubmission.submitFailed": 1,
      "frameBoundaryValidation.diagnosticWarnings": 1,
      "mvpFrameReadiness.frameBoundaryNotReady": 1,
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });
});

function readyInput(): {
  readonly renderer: RendererAssemblySmokeReport;
  readonly renderPass: RenderPassAssemblySmokeReport;
  readonly submission: FrameSubmissionSmokeReport;
  readonly boundary: FrameBoundaryValidationReport;
  readonly mvp: MvpFrameReadinessReport;
  readonly commandSubmission: CommandSubmissionMetricsReport;
} {
  return {
    renderer: renderer(true),
    renderPass: renderPass(true),
    submission: submission(true),
    boundary: boundary(true),
    mvp: mvp(true),
    commandSubmission: commandSubmission(true),
  };
}

function renderer(ready: boolean): RendererAssemblySmokeReport {
  return {
    ready,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "rendererAssembly.missingSnapshotViews",
            message: "No extracted views.",
            severity: "warning",
            section: "snapshot",
          },
        ],
    summary: {
      snapshot: null,
      cloneability: null,
      packages: null,
      resources: null,
      frame: {
        frame: 7,
        ready,
        draws: 3,
        batches: 2,
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
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
        commandCount: 4,
        indexedDrawCount: 2,
        nonIndexedDrawCount: 1,
      },
      execution: {
        valid: ready,
        commandCount: 4,
        executedCommands: ready ? 4 : 3,
        skippedCommands: ready ? 0 : 1,
        drawCalls: ready ? 2 : 1,
      },
    },
  };
}

function submission(ready: boolean): FrameSubmissionSmokeReport {
  return {
    ready,
    sections: {} as FrameSubmissionSmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "frameSubmission.submitFailed",
            message: "Submit failed.",
            severity: "error",
            section: "submit",
          },
        ],
    summary: {
      attachments: { valid: ready, colorTargets: 1 },
      begin: { valid: ready, hasPass: ready },
      execution: {
        valid: ready,
        executedCommands: ready ? 4 : 3,
        skippedCommands: ready ? 0 : 1,
        drawCalls: ready ? 2 : 1,
      },
      end: { valid: ready, ended: ready },
      finish: {
        valid: ready,
        commandBufferKey: ready ? "command-buffer:frame" : null,
      },
      submit: {
        valid: ready,
        submitted: ready ? 1 : 0,
        skipped: ready ? 0 : 1,
      },
    },
  };
}

function boundary(ready: boolean): FrameBoundaryValidationReport {
  return {
    ready,
    counts: {
      smokeDiagnostics: ready ? 0 : 1,
      compatibilityDiagnostics: 0,
      sourceDiagnostics: ready ? 0 : 1,
      warnings: ready ? 0 : 1,
      errors: 0,
    },
    diagnostics: ready
      ? []
      : [
          {
            code: "frameBoundaryValidation.diagnosticWarnings",
            message: "Frame boundary source diagnostics include warnings.",
          },
        ],
  };
}

function mvp(ready: boolean): MvpFrameReadinessReport {
  return {
    ready,
    sections: {
      rendererAssembly: ready,
      renderPassAssembly: ready,
      frameSubmission: ready,
      frameBoundary: ready,
    },
    counts: {
      rendererDiagnostics: ready ? 0 : 1,
      renderPassDiagnostics: ready ? 0 : 1,
      submissionDiagnostics: ready ? 0 : 1,
      boundaryDiagnostics: ready ? 0 : 1,
    },
    diagnostics: ready
      ? []
      : [
          {
            code: "mvpFrameReadiness.frameBoundaryNotReady",
            message: "Frame boundary validation report is not ready.",
          },
        ],
  };
}

function commandSubmission(ready: boolean): CommandSubmissionMetricsReport {
  return {
    ready,
    counts: {
      commands: 4,
      executedCommands: ready ? 4 : 3,
      skippedCommands: ready ? 0 : 1,
      drawCalls: ready ? 2 : 1,
      commandBuffers: ready ? 1 : 0,
      submittedCommandBuffers: ready ? 1 : 0,
      skippedSubmissions: ready ? 0 : 1,
    },
    diagnostics: ready
      ? []
      : [
          {
            code: "commandSubmissionMetrics.submitFailed",
            message: "Queue submission failed.",
          },
        ],
  };
}
