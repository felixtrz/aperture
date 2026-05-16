import { describe, expect, it } from "vitest";

import {
  createFrameSubmissionSmokeReport,
  type BeginRenderPassResult,
  type CreateRenderPassAttachmentPlanResult,
  type EndRenderPassResult,
  type FinishCommandEncoderResult,
  type RenderPassCommandExecutionReport,
  type SubmitCommandBuffersReport,
} from "@aperture-engine/webgpu";
import { createFrameExecutionSmokeFixture } from "./fixtures/frame-execution.js";

describe("frame submission smoke report", () => {
  it("reports ready when all submission sections are ready", () => {
    const report = createFrameExecutionSmokeFixture().submissionSmoke;

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(
      Object.values(report.sections).every((section) => section.ready),
    ).toBe(true);
    expect(report.summary.attachments?.colorTargets).toBe(1);
    expect(report.summary.finish?.commandBufferKey).toBe(
      "command-buffer:fixture-frame",
    );
    expect(report.summary.submit?.submitted).toBe(1);
  });

  it("reports missing attachment plans", () => {
    const report = createFrameSubmissionSmokeReport({
      attachments: null,
      begin: begin(true),
      execution: execution(true),
      end: end(true),
      finish: finish(true),
      submit: submit(true),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.attachments).toMatchObject({
      present: false,
      ready: false,
      diagnosticCodes: ["frameSubmission.missingAttachmentPlan"],
    });
  });

  it("reports failed pass begin", () => {
    const report = createFrameSubmissionSmokeReport({
      attachments: attachments(true),
      begin: begin(false),
      execution: execution(true),
      end: end(true),
      finish: finish(true),
      submit: submit(true),
    });

    expect(report.ready).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "frameSubmission.beginFailed",
      "renderPassLifecycle.missingBeginRenderPass",
    ]);
  });

  it("reports failed finish and failed submit", () => {
    const report = createFrameSubmissionSmokeReport({
      attachments: attachments(true),
      begin: begin(true),
      execution: execution(true),
      end: end(true),
      finish: finish(false),
      submit: submit(false),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.finish.diagnosticCodes).toEqual([
      "frameSubmission.finishFailed",
    ]);
    expect(report.sections.submit.diagnosticCodes).toEqual([
      "frameSubmission.submitFailed",
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "frameSubmission.finishFailed",
      "commandBuffer.missingFinish",
      "frameSubmission.submitFailed",
      "queueSubmit.missingSubmit",
    ]);
  });
});

function attachments(valid: boolean): CreateRenderPassAttachmentPlanResult {
  return {
    valid,
    plan: valid
      ? { colorAttachments: [{ view: {}, loadOp: "clear", storeOp: "store" }] }
      : null,
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassAttachment.missingColorTarget",
            message: "missing",
          },
        ],
  };
}

function begin(valid: boolean): BeginRenderPassResult {
  return {
    valid,
    pass: valid ? {} : null,
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassLifecycle.missingBeginRenderPass",
            message: "missing",
          },
        ],
  };
}

function execution(valid: boolean): RenderPassCommandExecutionReport {
  return {
    valid,
    commandCount: 1,
    executedCommands: valid ? 1 : 0,
    skippedCommands: valid ? 0 : 1,
    drawCalls: valid ? 1 : 0,
    indexedDrawCalls: valid ? 1 : 0,
    nonIndexedDrawCalls: 0,
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassCommandExecutor.missingMethod",
            method: "drawIndexed",
            renderId: 1,
            message: "missing",
          },
        ],
  };
}

function end(valid: boolean): EndRenderPassResult {
  return {
    valid,
    ended: valid,
    diagnostics: valid
      ? []
      : [{ code: "renderPassLifecycle.missingEnd", message: "missing" }],
  };
}

function finish(valid: boolean): FinishCommandEncoderResult {
  return {
    valid,
    resource: valid
      ? { resourceKey: "command-buffer:frame", commandBuffer: {} }
      : null,
    diagnostics: valid
      ? []
      : [{ code: "commandBuffer.missingFinish", message: "missing" }],
  };
}

function submit(valid: boolean): SubmitCommandBuffersReport {
  return {
    valid,
    submitted: valid ? 1 : 0,
    skipped: valid ? 0 : 1,
    commandBufferKeys: valid ? ["command-buffer:frame"] : [],
    diagnostics: valid
      ? []
      : [{ code: "queueSubmit.missingSubmit", message: "missing" }],
  };
}
