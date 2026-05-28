import { describe, expect, it } from "vitest";

import {
  runInjectedRendererFrameSummary,
  type RenderPassAssemblySmokeReport,
  type RenderPassCommand,
  type RendererAssemblySmokeReport,
} from "@aperture-engine/webgpu/test-support";

type FailurePoint = "texture" | "execute" | "finish" | "submit";

describe("injected renderer frame summary runner", () => {
  it("combines ready renderer reports with injected frame execution", () => {
    const events: string[] = [];
    const report = runInjectedRendererFrameSummary({
      renderer: renderer(true),
      renderPass: renderPass(true),
      frameExecution: frameExecution(events),
    });

    expect(report.assembly.valid).toBe(true);
    expect(report.execution.ready).toBe(true);
    expect(report.summary.ready).toBe(true);
    expect(report.json.ready).toBe(true);
    expect(report.summary.counts).toMatchObject({
      plannedDraws: 3,
      commands: 1,
      executedCommands: 1,
      submittedCommandBuffers: 1,
    });
    expect(events).toEqual(["begin", "draw", "end", "finish", "submit:1"]);
  });

  it("preserves renderer failures in the summary", () => {
    const report = runInjectedRendererFrameSummary({
      renderer: renderer(false),
      renderPass: renderPass(true),
      frameExecution: frameExecution([]),
    });

    expect(report.summary.ready).toBe(false);
    expect(report.summary.sections.rendererAssembly.ready).toBe(false);
    expect(report.summary.sections.mvpFrameReadiness.ready).toBe(false);
    expect(report.summary.diagnosticSummary.byCode).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
      "mvpFrameReadiness.rendererAssemblyNotReady": 1,
    });
  });

  it("preserves render-pass failures in the summary", () => {
    const report = runInjectedRendererFrameSummary({
      renderer: renderer(true),
      renderPass: renderPass(false),
      frameExecution: frameExecution([]),
    });

    expect(report.summary.ready).toBe(false);
    expect(report.summary.sections.renderPassAssembly.ready).toBe(false);
    expect(report.summary.sections.mvpFrameReadiness.ready).toBe(false);
    expect(report.summary.diagnosticSummary.byCode).toMatchObject({
      "renderPassAssembly.commandPlanNotReady": 1,
      "mvpFrameReadiness.renderPassAssemblyNotReady": 1,
    });
  });

  it("reports texture failures without command metrics handles", () => {
    const report = runInjectedRendererFrameSummary({
      renderer: renderer(true),
      renderPass: renderPass(true),
      frameExecution: frameExecution([], "texture"),
    });

    expect(report.execution.sections.commandSubmissionMetrics.present).toBe(
      false,
    );
    expect(report.summary.sections.commandSubmissionMetrics.present).toBe(
      false,
    );
    expect(JSON.stringify(report.json)).not.toContain("command-buffer");
    expect(JSON.stringify(report.json)).not.toContain("command-encoder");
  });

  it("reports execution failures through derived command metrics", () => {
    const report = runInjectedRendererFrameSummary({
      renderer: renderer(true),
      renderPass: renderPass(true),
      frameExecution: frameExecution([], "execute"),
    });

    expect(report.summary.ready).toBe(false);
    expect(report.summary.sections.commandSubmissionMetrics).toMatchObject({
      present: true,
      ready: false,
    });
    expect(report.summary.diagnosticSummary.byCode).toMatchObject({
      "commandSubmissionMetrics.executionFailed": 1,
    });
  });

  it("reports submit failures through derived submission and metrics sections", () => {
    const report = runInjectedRendererFrameSummary({
      renderer: renderer(true),
      renderPass: renderPass(true),
      frameExecution: frameExecution([], "submit"),
    });

    expect(report.summary.ready).toBe(false);
    expect(report.summary.sections.frameSubmission.ready).toBe(false);
    expect(report.summary.sections.commandSubmissionMetrics.ready).toBe(false);
    expect(report.json.diagnostics.byCode).toMatchObject({
      "frameSubmission.submitFailed": 1,
      "commandSubmissionMetrics.submitFailed": 1,
    });
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

function frameExecution(events: string[], failAt?: FailurePoint) {
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
    label: "summary-runner-frame",
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
