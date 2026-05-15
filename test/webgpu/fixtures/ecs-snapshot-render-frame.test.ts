import { describe, expect, it } from "vitest";

import { createEcsSnapshotRenderFrameFixture } from "./ecs-snapshot-render-frame.js";

describe("ECS-extracted snapshot render frame fixture", () => {
  it("extracts ECS authoring into a ready multi-draw snapshot frame", () => {
    const fixture = createEcsSnapshotRenderFrameFixture();
    const report = fixture.report;

    expect(fixture.snapshot.report).toMatchObject({
      views: 1,
      meshDraws: 2,
      diagnostics: 0,
    });
    expect(fixture.bindingPlan).toMatchObject({
      bindings: [{ renderId: 1 }, { renderId: 2 }],
      diagnostics: [],
    });
    expect(report.apply).toMatchObject({
      created: 2,
      updated: 0,
      active: 2,
    });
    expect(report.bindings.every((binding) => binding.result.ok)).toBe(true);
    expect(report.transforms.offsets).toHaveLength(2);
    expect(report.readiness.ready).toHaveLength(2);
    expect(report.frame.packages.packages).toHaveLength(2);
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

  it("keeps extraction diagnostics for skipped invalid renderables", () => {
    const fixture = createEcsSnapshotRenderFrameFixture({
      failAt: "invalidRenderable",
    });

    expect(fixture.snapshot.report).toMatchObject({
      views: 1,
      meshDraws: 2,
      diagnostics: 1,
    });
    expect(fixture.snapshot.diagnostics).toMatchObject([
      { code: "render.missingMeshHandle" },
    ]);
    expect(fixture.bindingPlan.diagnostics).toEqual([]);
    expect(fixture.report.frame.packages.packages).toHaveLength(2);
  });

  it("supports injected submit failures after ECS extraction", () => {
    const fixture = createEcsSnapshotRenderFrameFixture({ failAt: "submit" });

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
