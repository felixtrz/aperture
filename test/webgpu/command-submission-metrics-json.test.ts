import { describe, expect, it } from "vitest";

import {
  commandSubmissionMetricsReportToJson,
  commandSubmissionMetricsReportToJsonValue,
  createCommandSubmissionMetricsReport,
  type FinishCommandEncoderResult,
  type RenderPassCommandExecutionReport,
  type SubmitCommandBuffersReport,
} from "../../src/index.js";

describe("command submission metrics JSON helpers", () => {
  it("creates JSON-safe values for ready reports", () => {
    const report = createCommandSubmissionMetricsReport({
      execution: execution(true),
      finish: finish(true),
      submit: submit(true),
    });

    expect(commandSubmissionMetricsReportToJsonValue(report)).toEqual({
      ready: true,
      counts: {
        commands: 5,
        executedCommands: 5,
        skippedCommands: 0,
        drawCalls: 1,
        commandBuffers: 1,
        submittedCommandBuffers: 1,
        skippedSubmissions: 0,
      },
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("summarizes execution, finish, and submit failures", () => {
    const report = commandSubmissionMetricsReportToJsonValue(
      createCommandSubmissionMetricsReport({
        execution: execution(false),
        finish: finish(false),
        submit: submit(false),
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.counts).toMatchObject({
      executedCommands: 4,
      skippedCommands: 1,
      commandBuffers: 0,
      submittedCommandBuffers: 0,
      skippedSubmissions: 1,
    });
    expect(report.diagnostics).toMatchObject({
      total: 3,
      bySeverity: { warning: 3 },
      byCode: {
        "commandSubmissionMetrics.executionFailed": 1,
        "commandSubmissionMetrics.finishFailed": 1,
        "commandSubmissionMetrics.submitFailed": 1,
      },
    });
  });

  it("serializes stable repeated JSON output", () => {
    const report = createCommandSubmissionMetricsReport({
      execution: execution(false),
      finish: finish(true),
      submit: submit(true),
    });

    expect(JSON.parse(commandSubmissionMetricsReportToJson(report))).toEqual(
      commandSubmissionMetricsReportToJsonValue(report),
    );
    expect(commandSubmissionMetricsReportToJson(report)).toBe(
      commandSubmissionMetricsReportToJson(report),
    );
  });
});

function execution(valid: boolean): RenderPassCommandExecutionReport {
  return {
    valid,
    commandCount: 5,
    executedCommands: valid ? 5 : 4,
    skippedCommands: valid ? 0 : 1,
    drawCalls: valid ? 1 : 0,
    indexedDrawCalls: valid ? 1 : 0,
    nonIndexedDrawCalls: 0,
    diagnostics: [],
  };
}

function finish(valid: boolean): FinishCommandEncoderResult {
  return {
    valid,
    resource: valid
      ? { resourceKey: "command-buffer:frame", commandBuffer: {} }
      : null,
    diagnostics: [],
  };
}

function submit(valid: boolean): SubmitCommandBuffersReport {
  return {
    valid,
    submitted: valid ? 1 : 0,
    skipped: valid ? 0 : 1,
    commandBufferKeys: valid ? ["command-buffer:frame"] : [],
    diagnostics: [],
  };
}
