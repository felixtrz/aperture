import { describe, expect, it } from "vitest";

import {
  injectedRenderFrameDrawPackageRunnerReportToJson,
  injectedRenderFrameDrawPackageRunnerReportToJsonValue,
  type InjectedRenderFrameDrawPackageRunnerReport,
} from "../../src/index.js";
import { createDrawPackageRenderFrameFixture } from "./fixtures/draw-package-render-frame.js";

describe("injected render frame draw-package JSON helpers", () => {
  it("creates JSON-safe values for ready draw-package runner reports", () => {
    const report = injectedRenderFrameDrawPackageRunnerReportToJsonValue(
      runnerReport(createDrawPackageRenderFrameFixture()),
    );

    expect(report).toMatchObject({
      ready: true,
      descriptors: {
        valid: true,
        descriptorCount: 2,
        renderIds: [7, 9],
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
        },
      },
      frame: {
        ready: true,
        drawList: { drawCount: 2, renderIds: [7, 9] },
      },
    });
  });

  it("serializes descriptor failures", () => {
    const report = injectedRenderFrameDrawPackageRunnerReportToJsonValue(
      runnerReport(
        createDrawPackageRenderFrameFixture({ failAt: "missingMesh" }),
      ),
    );

    expect(report.ready).toBe(false);
    expect(report.descriptors).toMatchObject({
      valid: false,
      descriptorCount: 1,
      renderIds: [7],
    });
    expect(report.descriptors.diagnostics.byCode).toMatchObject({
      "drawCommand.missingMeshResource": 1,
    });
  });

  it("serializes frame failures", () => {
    const report = injectedRenderFrameDrawPackageRunnerReportToJsonValue(
      runnerReport(createDrawPackageRenderFrameFixture({ failAt: "submit" })),
    );

    expect(report.ready).toBe(false);
    expect(report.descriptors.valid).toBe(true);
    expect(
      report.frame.frame.frameExecution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });

  it("produces stable repeated JSON without raw handles", () => {
    const report = runnerReport(createDrawPackageRenderFrameFixture());
    const json = injectedRenderFrameDrawPackageRunnerReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      injectedRenderFrameDrawPackageRunnerReportToJsonValue(report),
    );
    expect(json).toBe(injectedRenderFrameDrawPackageRunnerReportToJson(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
    expect(json).not.toContain("command-buffer");
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
