import { describe, expect, it } from "vitest";

import { createSnapshotRenderFrameFixture } from "./snapshot-render-frame.js";

describe("snapshot injected render frame fixture", () => {
  it("runs ready multi-draw snapshot frames", () => {
    const fixture = createSnapshotRenderFrameFixture();
    const report = fixture.report;

    expect(report.apply).toMatchObject({
      created: 2,
      updated: 0,
      removed: 0,
      active: 2,
    });
    expect(report.bindings).toHaveLength(2);
    expect(report.bindings.every((binding) => binding.result.ok)).toBe(true);
    expect(report.transforms.offsets.map((offset) => offset.renderId)).toEqual([
      7, 9,
    ]);
    expect(report.readiness.ready.map((draw) => draw.renderId)).toEqual([7, 9]);
    expect(report.frame.packages.packages.map((pkg) => pkg.renderId)).toEqual([
      7, 9,
    ]);
    expect(report.frame.frame.descriptors.descriptors).toHaveLength(2);
    expect(report.frame.frame.frame.drawList.draws).toHaveLength(2);
    expect(report.frame.frame.frame.frame.execution.counts).toMatchObject({
      commands: 12,
      executedCommands: 12,
      drawCalls: 2,
    });
    expect(report.frame.frame.frame.frame.summary.counts).toMatchObject({
      plannedDraws: 2,
      drawCalls: 2,
      commands: 12,
    });
  });

  it("reports duplicate render ids during snapshot apply", () => {
    const fixture = createSnapshotRenderFrameFixture({
      failAt: "duplicateRenderIds",
    });

    expect(fixture.report.apply.diagnostics).toMatchObject([
      { code: "renderWorld.duplicateRenderId" },
    ]);
    expect(fixture.report.frame.packages.packages).toHaveLength(1);
  });

  it("reports missing resource bindings before packaging", () => {
    const fixture = createSnapshotRenderFrameFixture({
      failAt: "missingResourceBindings",
    });

    expect(fixture.report.readiness.blocked).toMatchObject([
      {
        renderId: 9,
        missing: ["missing-mesh-resource", "missing-material-resource"],
      },
    ]);
    expect(fixture.report.frame.packages.diagnostics).toMatchObject([
      { code: "renderDrawPackage.blockedDraw" },
    ]);
  });

  it("reports missing transforms before descriptor planning", () => {
    const fixture = createSnapshotRenderFrameFixture({
      failAt: "missingTransforms",
    });

    expect(fixture.report.transforms.diagnostics).toMatchObject([
      { code: "renderTransformPack.missingTransform" },
    ]);
    expect(fixture.report.frame.packages.diagnostics).toMatchObject([
      { code: "renderTransformPack.missingTransform" },
      { code: "renderDrawPackage.missingPackedTransform" },
    ]);
    expect(fixture.report.frame.frame.descriptors.descriptors).toHaveLength(1);
  });

  it("supports injected submit failures", () => {
    const fixture = createSnapshotRenderFrameFixture({ failAt: "submit" });

    expect(fixture.report.frame.frame.frame.frame.execution.ready).toBe(false);
    expect(
      fixture.report.frame.frame.frame.frame.execution.sections
        .commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
    expect(
      fixture.report.frame.frame.frame.frame.summary.diagnosticSummary.byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });
});
