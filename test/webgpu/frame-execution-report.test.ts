import { describe, expect, it } from "vitest";

import { createFrameExecutionReport } from "@aperture-engine/webgpu";
import { createFrameExecutionSmokeFixture } from "./fixtures/frame-execution.js";

describe("frame execution aggregate report", () => {
  it("derives ready frame execution reports from a boundary assembly", () => {
    const report = createFrameExecutionReport(
      createFrameExecutionSmokeFixture().assembly,
    );

    expect(report.ready).toBe(true);
    expect(
      Object.values(report.sections).every((section) => section.ready),
    ).toBe(true);
    expect(report.reports.boundarySmoke.ready).toBe(true);
    expect(report.reports.clearCompatibility.ready).toBe(true);
    expect(report.reports.boundaryValidation.ready).toBe(true);
    expect(report.reports.submissionSmoke.ready).toBe(true);
    expect(report.reports.commandSubmissionMetrics?.ready).toBe(true);
    expect(report.counts).toMatchObject({
      commands: 1,
      executedCommands: 1,
      skippedCommands: 0,
      drawCalls: 1,
      commandBuffers: 1,
      submittedCommandBuffers: 1,
      skippedSubmissions: 0,
      diagnostics: 0,
    });
  });

  it("reports texture failures and missing command metrics inputs", () => {
    const report = createFrameExecutionReport(
      createFrameExecutionSmokeFixture({ failAt: "texture" }).assembly,
    );

    expect(report.ready).toBe(false);
    expect(report.sections.boundarySmoke.ready).toBe(false);
    expect(report.sections.clearCompatibility.ready).toBe(false);
    expect(report.sections.commandSubmissionMetrics).toMatchObject({
      present: false,
      ready: false,
      diagnosticCodes: [
        "frameExecution.missingExecution",
        "frameExecution.missingFinish",
        "frameExecution.missingSubmit",
      ],
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "clearCompatibility.missingTextureView",
    );
  });

  it("reports execution and finish boundary failures", () => {
    const executionFailure = createFrameExecutionReport(
      createFrameExecutionSmokeFixture({ failAt: "execute" }).assembly,
    );
    const finishFailure = createFrameExecutionReport(
      createFrameExecutionSmokeFixture({ failAt: "finish" }).assembly,
    );

    expect(executionFailure.ready).toBe(false);
    expect(
      executionFailure.reports.commandSubmissionMetrics?.diagnostics,
    ).toMatchObject([{ code: "commandSubmissionMetrics.executionFailed" }]);
    expect(executionFailure.sections.commandSubmissionMetrics.present).toBe(
      true,
    );
    expect(finishFailure.ready).toBe(false);
    expect(finishFailure.sections.submissionSmoke.diagnosticCodes).toContain(
      "frameSubmission.finishFailed",
    );
    expect(finishFailure.sections.commandSubmissionMetrics).toMatchObject({
      present: false,
      diagnosticCodes: ["frameExecution.missingSubmit"],
    });
  });

  it("reports submit failures through submission smoke and command metrics", () => {
    const report = createFrameExecutionReport(
      createFrameExecutionSmokeFixture({ failAt: "submit" }).assembly,
    );

    expect(report.ready).toBe(false);
    expect(report.sections.submissionSmoke.diagnosticCodes).toContain(
      "frameSubmission.submitFailed",
    );
    expect(report.sections.commandSubmissionMetrics).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["commandSubmissionMetrics.submitFailed"],
    });
    expect(report.counts).toMatchObject({
      submittedCommandBuffers: 0,
      skippedSubmissions: 1,
    });
  });
});
