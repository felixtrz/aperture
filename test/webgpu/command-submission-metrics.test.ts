import { describe, expect, it } from "vitest";

import {
  createCommandSubmissionMetricsReport,
  type FinishCommandEncoderResult,
  type RenderPassCommandExecutionReport,
  type SubmitCommandBuffersReport,
} from "@aperture-engine/webgpu/test-support";

describe("command submission metrics report", () => {
  it("reports all-ready command submission metrics", () => {
    expect(
      createCommandSubmissionMetricsReport({
        execution: execution(true),
        finish: finish(true),
        submit: submit(true),
      }),
    ).toEqual({
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
      diagnostics: [],
    });
  });

  it("reports execution, finish, and submit failures", () => {
    const report = createCommandSubmissionMetricsReport({
      execution: execution(false),
      finish: finish(false),
      submit: submit(false),
    });

    expect(report.ready).toBe(false);
    expect(report.counts).toMatchObject({
      executedCommands: 4,
      skippedCommands: 1,
      commandBuffers: 0,
      submittedCommandBuffers: 0,
      skippedSubmissions: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "commandSubmissionMetrics.executionFailed",
      "commandSubmissionMetrics.finishFailed",
      "commandSubmissionMetrics.submitFailed",
    ]);
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
