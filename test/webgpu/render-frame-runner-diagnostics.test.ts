import { describe, expect, it } from "vitest";

import {
  summarizeInjectedRenderFrameDiagnosticsByPhase,
  type InjectedRenderFrameRunnerReport,
} from "@aperture-engine/webgpu/test-support";
import { createInjectedRenderFrameSmokeFixture } from "./fixtures/injected-render-frame.js";

describe("injected render frame diagnostics by phase", () => {
  it("groups renderer failures", () => {
    const report = summarizeInjectedRenderFrameDiagnosticsByPhase(
      runnerReport(
        createInjectedRenderFrameSmokeFixture({
          failAt: "renderer",
        }),
      ),
    );

    expect(report.ready).toBe(false);
    expect(report.phases.rendererAssembly.diagnostics.byCode).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
    });
    expect(
      report.phases.rendererFrameSummary.sections.mvpFrameReadiness.diagnostics
        .byCode,
    ).toMatchObject({
      "mvpFrameReadiness.rendererAssemblyNotReady": 1,
    });
  });

  it("groups render-pass failures", () => {
    const report = summarizeInjectedRenderFrameDiagnosticsByPhase(
      runnerReport(
        createInjectedRenderFrameSmokeFixture({
          failAt: "renderPassResource",
        }),
      ),
    );

    expect(
      report.phases.renderPassAssembly.sections.resources.diagnostics.byCode,
    ).toMatchObject({
      "renderPassAssembly.resourcesNotReady": 1,
      "renderPassResource.missingPipeline": 1,
    });
    expect(
      report.phases.rendererFrameSummary.sections.renderPassAssembly.diagnostics
        .byCode,
    ).toMatchObject({
      "renderPassAssembly.resourcesNotReady": 1,
    });
  });

  it("groups frame execution failures", () => {
    const report = summarizeInjectedRenderFrameDiagnosticsByPhase(
      runnerReport(
        createInjectedRenderFrameSmokeFixture({
          failAt: "submit",
        }),
      ),
    );

    expect(
      report.phases.frameExecution.sections.commandSubmissionMetrics.diagnostics
        .byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
    expect(
      report.phases.rendererFrameSummary.sections.commandSubmissionMetrics
        .diagnostics.byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const report = summarizeInjectedRenderFrameDiagnosticsByPhase(
      runnerReport(
        createInjectedRenderFrameSmokeFixture({
          failAt: "commandExecution",
        }),
      ),
    );
    const json = JSON.stringify(report);

    expect(json).toBe(JSON.stringify(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
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
