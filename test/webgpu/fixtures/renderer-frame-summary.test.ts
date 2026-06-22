import { describe, expect, it } from "vitest";

import { createRendererFrameSummaryFixture } from "./renderer-frame-summary.js";

describe("renderer frame summary fixture", () => {
  it("builds a ready summary and JSON value", () => {
    const fixture = createRendererFrameSummaryFixture();

    expect(fixture.summary.ready).toBe(true);
    expect(fixture.json.ready).toBe(true);
    expect(fixture.json.sections.rendererAssembly.ready).toBe(true);
    expect(fixture.json.sections.renderPassAssembly.ready).toBe(true);
    expect(fixture.json.sections.frameSubmission.ready).toBe(true);
    expect(fixture.json.counts).toMatchObject({
      plannedDraws: 3,
      commands: 1,
      executedCommands: 1,
      submittedCommandBuffers: 1,
    });
    expect(fixture.events).toEqual([
      "begin",
      "draw",
      "end",
      "finish",
      "submit:1",
    ]);
  });

  it("can inject renderer and render-pass failures", () => {
    const rendererFailure = createRendererFrameSummaryFixture({
      failAt: "renderer",
    });
    const renderPassFailure = createRendererFrameSummaryFixture({
      failAt: "renderPass",
    });

    expect(rendererFailure.summary.ready).toBe(false);
    expect(rendererFailure.summary.sections.rendererAssembly.ready).toBe(false);
    expect(rendererFailure.summary.sections.mvpFrameReadiness.ready).toBe(
      false,
    );
    expect(renderPassFailure.summary.ready).toBe(false);
    expect(renderPassFailure.summary.sections.renderPassAssembly.ready).toBe(
      false,
    );
    expect(
      renderPassFailure.summary.diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain("mvpFrameReadiness.renderPassAssemblyNotReady");
  });

  it("can inject texture, execution, finish, and submit failures", () => {
    const textureFailure = createRendererFrameSummaryFixture({
      failAt: "texture",
    });
    const executionFailure = createRendererFrameSummaryFixture({
      failAt: "execute",
    });
    const finishFailure = createRendererFrameSummaryFixture({
      failAt: "finish",
    });
    const submitFailure = createRendererFrameSummaryFixture({
      failAt: "submit",
    });

    expect(textureFailure.summary.sections.frameSubmission.ready).toBe(false);
    expect(
      textureFailure.summary.sections.commandSubmissionMetrics.present,
    ).toBe(false);
    expect(
      executionFailure.summary.sections.commandSubmissionMetrics.ready,
    ).toBe(false);
    expect(
      finishFailure.summary.sections.commandSubmissionMetrics.present,
    ).toBe(false);
    expect(submitFailure.summary.sections.commandSubmissionMetrics.ready).toBe(
      false,
    );
  });
});
