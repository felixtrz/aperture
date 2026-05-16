import { describe, expect, it } from "vitest";

import {
  createFrameExecutionReport,
  frameExecutionReportToJson,
  frameExecutionReportToJsonValue,
  type FrameExecutionReport,
} from "@aperture-engine/webgpu";
import { createFrameExecutionSmokeFixture } from "./fixtures/frame-execution.js";

describe("frame execution report JSON helpers", () => {
  it("creates JSON-safe values with sections, counts, and diagnostics", () => {
    const report = createFrameExecutionReport(
      createFrameExecutionSmokeFixture().assembly,
    );

    expect(frameExecutionReportToJsonValue(report)).toEqual({
      ready: true,
      sections: {
        boundarySmoke: { present: true, ready: true, diagnosticCodes: [] },
        clearCompatibility: {
          present: true,
          ready: true,
          diagnosticCodes: [],
        },
        diagnosticSummary: { present: true, ready: true, diagnosticCodes: [] },
        boundaryValidation: {
          present: true,
          ready: true,
          diagnosticCodes: [],
        },
        submissionSmoke: { present: true, ready: true, diagnosticCodes: [] },
        commandSubmissionMetrics: {
          present: true,
          ready: true,
          diagnosticCodes: [],
        },
      },
      counts: {
        commands: 1,
        executedCommands: 1,
        skippedCommands: 0,
        drawCalls: 1,
        commandBuffers: 1,
        submittedCommandBuffers: 1,
        skippedSubmissions: 0,
        smokeDiagnostics: 0,
        compatibilityDiagnostics: 0,
        sourceDiagnostics: 0,
        validationDiagnostics: 0,
        submissionDiagnostics: 0,
        commandSubmissionDiagnostics: 0,
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
    const report = createFrameExecutionReport(
      createFrameExecutionSmokeFixture({ failAt: "submit" }).assembly,
    );

    expect(JSON.parse(frameExecutionReportToJson(report)) as unknown).toEqual(
      frameExecutionReportToJsonValue(report),
    );
    expect(frameExecutionReportToJson(report)).toBe(
      frameExecutionReportToJson(report),
    );
  });

  it("does not leak detailed diagnostic messages or nested report handles", () => {
    const source = createFrameExecutionReport(
      createFrameExecutionSmokeFixture().assembly,
    );
    const report: FrameExecutionReport = {
      ...source,
      ready: false,
      diagnostics: [
        {
          section: "submissionSmoke",
          code: "frameSubmission.submitFailed",
          message:
            "Submit failed for texture-view-handle and command-encoder-handle.",
          severity: "error",
        },
      ],
      counts: {
        ...source.counts,
        diagnostics: 1,
      },
    };
    const json = frameExecutionReportToJson(report);

    expect(json).toContain("frameSubmission.submitFailed");
    expect(json).not.toContain("texture-view-handle");
    expect(json).not.toContain("command-encoder-handle");
    expect(json).not.toContain("reports");
  });
});
