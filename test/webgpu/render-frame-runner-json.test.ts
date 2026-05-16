import { describe, expect, it } from "vitest";

import {
  injectedRenderFrameRunnerReportToJson,
  injectedRenderFrameRunnerReportToJsonValue,
  type InjectedRenderFrameRunnerReport,
} from "@aperture-engine/webgpu";
import { createInjectedRenderFrameSmokeFixture } from "./fixtures/injected-render-frame.js";

describe("injected render frame runner JSON helpers", () => {
  it("creates JSON-safe values for ready render frame runner reports", () => {
    const report = injectedRenderFrameRunnerReportToJsonValue(
      runnerReport(createInjectedRenderFrameSmokeFixture()),
    );

    expect(report).toMatchObject({
      ready: true,
      boundary: { valid: true },
      renderPass: {
        ready: true,
        summary: {
          commands: { commandCount: 6, drawCount: 1 },
          execution: { commandCount: 6, drawCalls: 1 },
        },
      },
      frameExecution: {
        ready: true,
        counts: {
          commands: 6,
          executedCommands: 6,
          drawCalls: 1,
          submittedCommandBuffers: 1,
        },
      },
      summary: {
        ready: true,
        counts: {
          plannedDraws: 1,
          commands: 6,
          executedCommands: 6,
        },
      },
    });
  });

  it("serializes render-pass failures", () => {
    const report = injectedRenderFrameRunnerReportToJsonValue(
      runnerReport(
        createInjectedRenderFrameSmokeFixture({
          failAt: "renderPassResource",
        }),
      ),
    );

    expect(report.ready).toBe(false);
    expect(report.renderPass.sections.resources.ready).toBe(false);
    expect(report.summary.sections.renderPassAssembly.ready).toBe(false);
  });

  it("serializes frame execution failures", () => {
    const report = injectedRenderFrameRunnerReportToJsonValue(
      runnerReport(
        createInjectedRenderFrameSmokeFixture({
          failAt: "submit",
        }),
      ),
    );

    expect(report.ready).toBe(false);
    expect(report.boundary.valid).toBe(false);
    expect(report.frameExecution.sections.commandSubmissionMetrics.ready).toBe(
      false,
    );
    expect(report.summary.sections.commandSubmissionMetrics.ready).toBe(false);
  });

  it("produces stable repeated JSON without raw handles", () => {
    const report = runnerReport(createInjectedRenderFrameSmokeFixture());
    const json = injectedRenderFrameRunnerReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      injectedRenderFrameRunnerReportToJsonValue(report),
    );
    expect(json).toBe(injectedRenderFrameRunnerReportToJson(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
    expect(json).not.toContain("command-buffer");
  });
});

function runnerReport(
  fixture: ReturnType<typeof createInjectedRenderFrameSmokeFixture>,
): InjectedRenderFrameRunnerReport {
  return {
    renderPass: fixture.renderPassRun,
    assembly: fixture.boundary,
    execution: fixture.frameExecution,
    summary: fixture.summary,
    json: fixture.json,
  };
}
