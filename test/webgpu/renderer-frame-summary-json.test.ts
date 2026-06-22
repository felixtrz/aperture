import { describe, expect, it } from "vitest";

import {
  rendererFrameSummaryReportToJson,
  rendererFrameSummaryReportToJsonValue,
  type RendererFrameSummaryReport,
  type RendererFrameSummarySection,
  type RendererFrameSummarySectionStatus,
} from "@aperture-engine/webgpu/test-support";
import { createRendererFrameSummaryFixture } from "./fixtures/renderer-frame-summary.js";

describe("renderer frame summary JSON helpers", () => {
  it("creates JSON-safe values with section readiness, counts, and diagnostics", () => {
    expect(rendererFrameSummaryReportToJsonValue(report())).toEqual({
      ready: true,
      sections: {
        rendererAssembly: { present: true, ready: true, diagnosticCount: 0 },
        renderPassAssembly: { present: true, ready: true, diagnosticCount: 0 },
        frameSubmission: { present: true, ready: true, diagnosticCount: 0 },
        frameBoundary: { present: true, ready: true, diagnosticCount: 0 },
        mvpFrameReadiness: { present: true, ready: true, diagnosticCount: 0 },
        commandSubmissionMetrics: {
          present: true,
          ready: true,
          diagnosticCount: 0,
        },
      },
      counts: {
        plannedDraws: 3,
        drawCalls: 2,
        commands: 4,
        executedCommands: 4,
        skippedCommands: 0,
        commandBuffers: 1,
        submittedCommandBuffers: 1,
        skippedSubmissions: 0,
        diagnostics: 0,
      },
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("serializes stable repeated JSON output", () => {
    const source = createRendererFrameSummaryFixture().summary;

    expect(
      JSON.parse(rendererFrameSummaryReportToJson(source)) as unknown,
    ).toEqual(rendererFrameSummaryReportToJsonValue(source));
    expect(rendererFrameSummaryReportToJson(source)).toBe(
      rendererFrameSummaryReportToJson(source),
    );
  });

  it("omits detailed diagnostic payloads that may reference injected handles", () => {
    const json = rendererFrameSummaryReportToJson(
      report({
        ready: false,
        sections: {
          ...report().sections,
          frameSubmission: status("frameSubmission", true, false, 1),
        },
        counts: {
          ...report().counts,
          diagnostics: 1,
        },
        diagnostics: [
          {
            section: "frameSubmission",
            sourceSection: "submit",
            code: "frameSubmission.submitFailed",
            message:
              "Submit failed for command-encoder-handle and pass-encoder-handle.",
            severity: "error",
          },
        ],
        diagnosticSummary: {
          total: 1,
          bySeverity: { info: 0, warning: 0, error: 1 },
          byCode: { "frameSubmission.submitFailed": 1 },
        },
      }),
    );

    expect(json).toContain("frameSubmission.submitFailed");
    expect(json).not.toContain("command-encoder-handle");
    expect(json).not.toContain("pass-encoder-handle");
    expect(json).not.toContain("sourceSection");
  });
});

function report(
  overrides: Partial<RendererFrameSummaryReport> = {},
): RendererFrameSummaryReport {
  return {
    ready: true,
    sections: {
      rendererAssembly: status("rendererAssembly"),
      renderPassAssembly: status("renderPassAssembly"),
      frameSubmission: status("frameSubmission"),
      frameBoundary: status("frameBoundary"),
      mvpFrameReadiness: status("mvpFrameReadiness"),
      commandSubmissionMetrics: status("commandSubmissionMetrics"),
    },
    counts: {
      plannedDraws: 3,
      drawCalls: 2,
      commands: 4,
      executedCommands: 4,
      skippedCommands: 0,
      commandBuffers: 1,
      submittedCommandBuffers: 1,
      skippedSubmissions: 0,
      diagnostics: 0,
    },
    diagnostics: [],
    diagnosticSummary: {
      total: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      byCode: {},
    },
    ...overrides,
  };
}

function status(
  section: RendererFrameSummarySection,
  present = true,
  ready = true,
  diagnosticCount = 0,
): RendererFrameSummarySectionStatus {
  return {
    section,
    present,
    ready,
    diagnosticCount,
  };
}
