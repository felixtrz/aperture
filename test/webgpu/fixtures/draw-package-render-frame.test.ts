import { describe, expect, it } from "vitest";

import { createDrawPackageRenderFrameFixture } from "./draw-package-render-frame.js";

describe("draw-package injected render frame fixture", () => {
  it("creates descriptors and runs ready multi-draw frames", () => {
    const fixture = createDrawPackageRenderFrameFixture();

    expect(fixture.descriptors.diagnostics).toEqual([]);
    expect(
      fixture.descriptors.descriptors.map((descriptor) => descriptor.renderId),
    ).toEqual([7, 9]);
    expect(fixture.frame.drawList.draws.map((draw) => draw.renderId)).toEqual([
      7, 9,
    ]);
    expect(fixture.frame.frame.execution.counts).toMatchObject({
      commands: 12,
      executedCommands: 12,
      drawCalls: 2,
    });
    expect(fixture.frame.frame.summary.counts).toMatchObject({
      plannedDraws: 2,
      drawCalls: 2,
      commands: 12,
    });
  });

  it("reports missing mesh resources before draw-list planning", () => {
    const fixture = createDrawPackageRenderFrameFixture({
      failAt: "missingMesh",
    });

    expect(fixture.descriptors.diagnostics).toMatchObject([
      { code: "drawCommand.missingMeshResource", renderId: 9 },
    ]);
    expect(
      fixture.descriptors.descriptors.map((descriptor) => descriptor.renderId),
    ).toEqual([7]);
    expect(fixture.frame.frame.execution.counts).toMatchObject({
      commands: 6,
      drawCalls: 1,
    });
  });

  it("supports injected submit failures", () => {
    const fixture = createDrawPackageRenderFrameFixture({ failAt: "submit" });

    expect(fixture.frame.frame.execution.ready).toBe(false);
    expect(
      fixture.frame.frame.execution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
    expect(fixture.frame.frame.summary.diagnosticSummary.byCode).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });
});
