import { describe, expect, it } from "vitest";

import {
  summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase,
  type InjectedRenderFrameDrawPackageRunnerReport,
} from "../../src/index.js";
import { createDrawPackageRenderFrameFixture } from "./fixtures/draw-package-render-frame.js";

describe("injected render frame draw-package diagnostics by phase", () => {
  it("groups descriptor failures", () => {
    const report = summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(
      runnerReport(
        createDrawPackageRenderFrameFixture({ failAt: "missingMesh" }),
      ),
    );

    expect(report.ready).toBe(false);
    expect(report.phases.descriptors.diagnostics.byCode).toMatchObject({
      "drawCommand.missingMeshResource": 1,
    });
  });

  it("groups downstream frame failures", () => {
    const report = summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(
      runnerReport(createDrawPackageRenderFrameFixture({ failAt: "submit" })),
    );

    expect(
      report.phases.frame.phases.frame.phases.frameExecution.sections
        .commandSubmissionMetrics.diagnostics.byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
    expect(report.diagnostics.byCode).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const report = summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(
      runnerReport(createDrawPackageRenderFrameFixture()),
    );
    const json = JSON.stringify(report);

    expect(report.ready).toBe(true);
    expect(json).toBe(JSON.stringify(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
  });
});

function runnerReport(
  fixture: ReturnType<typeof createDrawPackageRenderFrameFixture>,
): InjectedRenderFrameDrawPackageRunnerReport {
  return {
    descriptors: fixture.descriptors,
    frame: fixture.frame,
  };
}
