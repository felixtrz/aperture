import { describe, expect, it } from "vitest";

import {
  createRendererFrameSummaryReport,
  summarizeRendererFrameSummaryDiagnosticsBySection,
} from "../../src/index.js";
import { createRendererFrameSummaryFixture } from "./fixtures/renderer-frame-summary.js";

describe("renderer frame summary diagnostics by section", () => {
  it("groups missing-section diagnostics", () => {
    const report = summarizeRendererFrameSummaryDiagnosticsBySection(
      createRendererFrameSummaryReport({
        renderer: null,
        renderPass: null,
        submission: null,
        boundary: null,
        mvp: null,
        commandSubmission: null,
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.diagnostics).toMatchObject({
      total: 6,
      bySeverity: { error: 6 },
    });
    expect(report.sections.rendererAssembly.diagnostics.byCode).toMatchObject({
      "rendererFrameSummary.missingRendererAssembly": 1,
    });
    expect(
      report.sections.commandSubmissionMetrics.diagnostics.byCode,
    ).toMatchObject({
      "rendererFrameSummary.missingCommandSubmissionMetrics": 1,
    });
  });

  it("groups source diagnostics by stable top-level section", () => {
    const rendererFailure = createRendererFrameSummaryFixture({
      failAt: "renderer",
    }).summary;
    const renderPassFailure = createRendererFrameSummaryFixture({
      failAt: "renderPass",
    }).summary;

    expect(
      summarizeRendererFrameSummaryDiagnosticsBySection(rendererFailure)
        .sections.rendererAssembly.diagnostics.byCode,
    ).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
    });
    expect(
      summarizeRendererFrameSummaryDiagnosticsBySection(renderPassFailure)
        .sections.renderPassAssembly.diagnostics.byCode,
    ).toMatchObject({
      "renderPassAssembly.commandPlanNotReady": 1,
    });
    expect(
      summarizeRendererFrameSummaryDiagnosticsBySection(renderPassFailure)
        .sections.mvpFrameReadiness.diagnostics.byCode,
    ).toMatchObject({
      "mvpFrameReadiness.renderPassAssemblyNotReady": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const summary = summarizeRendererFrameSummaryDiagnosticsBySection(
      createRendererFrameSummaryFixture({ failAt: "submit" }).summary,
    );

    expect(JSON.stringify(summary)).toBe(JSON.stringify(summary));
    expect(JSON.stringify(summary)).not.toContain("command-encoder-handle");
  });
});
