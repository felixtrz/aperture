import { describe, expect, it } from "vitest";

import { createRenderWorldPackageFrameFixture } from "./render-world-package-render-frame.js";

describe("render-world package injected render frame fixture", () => {
  it("runs ready multi-draw frames", () => {
    const fixture = createRenderWorldPackageFrameFixture();

    expect(fixture.report.packages.packages.map((pkg) => pkg.renderId)).toEqual(
      [9, 7],
    );
    expect(fixture.report.frame.descriptors.descriptors).toHaveLength(2);
    expect(fixture.report.frame.frame.drawList.draws).toHaveLength(2);
    expect(fixture.report.frame.frame.frame.execution.counts).toMatchObject({
      commands: 7,
      drawCalls: 2,
    });
  });

  it("reports blocked draws and missing packed transforms", () => {
    const blocked = createRenderWorldPackageFrameFixture({ failAt: "blocked" });
    const missingTransform = createRenderWorldPackageFrameFixture({
      failAt: "missingTransform",
    });

    expect(blocked.report.packages.diagnostics).toMatchObject([
      { code: "renderDrawPackage.blockedDraw" },
    ]);
    expect(missingTransform.report.packages.diagnostics).toMatchObject([
      { code: "renderDrawPackage.missingPackedTransform" },
    ]);
  });

  it("reports missing mesh resources and submit failures", () => {
    const missingMesh = createRenderWorldPackageFrameFixture({
      failAt: "missingMesh",
    });
    const submit = createRenderWorldPackageFrameFixture({ failAt: "submit" });

    expect(missingMesh.report.frame.descriptors.diagnostics).toMatchObject([
      { code: "drawCommand.missingMeshResource", renderId: 9 },
    ]);
    expect(
      submit.report.frame.frame.frame.execution.sections
        .commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });
});
