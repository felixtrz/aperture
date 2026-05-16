import { describe, expect, it } from "vitest";

import {
  runInjectedFrameExecution,
  type RenderPassCommand,
} from "@aperture-engine/webgpu";

type FailurePoint = "texture" | "execute" | "finish" | "submit";

describe("injected frame execution runner", () => {
  it("assembles a ready boundary and derives a frame execution report", () => {
    const events: string[] = [];
    const report = runInjectedFrameExecution(input(events));

    expect(report.assembly.valid).toBe(true);
    expect(report.execution.ready).toBe(true);
    expect(report.execution.counts).toMatchObject({
      commands: 1,
      executedCommands: 1,
      drawCalls: 1,
      commandBuffers: 1,
      submittedCommandBuffers: 1,
    });
    expect(events).toEqual(["begin", "draw", "end", "finish", "submit:1"]);
  });

  it("reports texture failures and missing execution inputs", () => {
    const report = runInjectedFrameExecution(input([], "texture"));

    expect(report.assembly.valid).toBe(false);
    expect(report.execution.sections.boundarySmoke.ready).toBe(false);
    expect(report.execution.sections.commandSubmissionMetrics).toMatchObject({
      present: false,
      diagnosticCodes: [
        "frameExecution.missingExecution",
        "frameExecution.missingFinish",
        "frameExecution.missingSubmit",
      ],
    });
  });

  it("reports execution failures through command submission metrics", () => {
    const report = runInjectedFrameExecution(input([], "execute"));

    expect(report.assembly.execution?.valid).toBe(false);
    expect(report.execution.reports.commandSubmissionMetrics).toMatchObject({
      ready: false,
      diagnostics: [{ code: "commandSubmissionMetrics.executionFailed" }],
    });
  });

  it("reports finish failures without leaking command buffers into metrics", () => {
    const report = runInjectedFrameExecution(input([], "finish"));

    expect(report.assembly.finish?.valid).toBe(false);
    expect(report.execution.sections.submissionSmoke.diagnosticCodes).toContain(
      "frameSubmission.finishFailed",
    );
    expect(report.execution.sections.commandSubmissionMetrics).toMatchObject({
      present: false,
      diagnosticCodes: ["frameExecution.missingSubmit"],
    });
  });

  it("reports submit failures through submission smoke and command metrics", () => {
    const report = runInjectedFrameExecution(input([], "submit"));

    expect(report.assembly.submit?.valid).toBe(false);
    expect(report.execution.sections.submissionSmoke.diagnosticCodes).toContain(
      "frameSubmission.submitFailed",
    );
    expect(report.execution.sections.commandSubmissionMetrics).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["commandSubmissionMetrics.submitFailed"],
    });
  });
});

function input(events: string[], failAt?: FailurePoint) {
  return {
    context: {
      getCurrentTexture: () =>
        failAt === "texture" ? {} : { createView: () => ({ label: "view" }) },
    },
    device: {
      createCommandEncoder: () => ({
        beginRenderPass: () => {
          events.push("begin");
          return {
            ...(failAt === "execute"
              ? {}
              : { draw: () => events.push("draw") }),
            end: () => events.push("end"),
          };
        },
        ...(failAt === "finish"
          ? {}
          : {
              finish: () => {
                events.push("finish");
                return { label: "command-buffer" };
              },
            }),
      }),
    },
    queue:
      failAt === "submit"
        ? {}
        : {
            submit: (buffers: readonly unknown[]) =>
              events.push(`submit:${buffers.length}`),
          },
    commands: [drawCommand()],
    label: "runner-frame",
    clearColor: [0, 0, 0, 1],
  };
}

function drawCommand(): RenderPassCommand {
  return {
    kind: "draw",
    renderId: 1,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}
