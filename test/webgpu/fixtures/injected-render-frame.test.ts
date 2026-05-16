import { describe, expect, it } from "vitest";

import { createInjectedRenderFrameSmokeFixture } from "./injected-render-frame.js";

describe("injected render frame smoke fixture", () => {
  it("wires renderer, render-pass, frame execution, summary, and JSON output", () => {
    const fixture = createInjectedRenderFrameSmokeFixture();

    expect(fixture.renderer.ready).toBe(true);
    expect(fixture.renderPass.ready).toBe(true);
    expect(fixture.frameExecution.ready).toBe(true);
    expect(fixture.summary.ready).toBe(true);
    expect(fixture.json.ready).toBe(true);
    expect(fixture.events).toEqual([
      "render-pass:pipeline",
      "render-pass:bind:0",
      "render-pass:bind:1",
      "render-pass:bind:2",
      "render-pass:vertex:0",
      "render-pass:draw:3",
      "frame:begin",
      "frame:pipeline",
      "frame:bind:0",
      "frame:bind:1",
      "frame:bind:2",
      "frame:vertex:0",
      "frame:draw:3",
      "frame:end",
      "frame:finish",
      "frame:submit:1",
    ]);
  });

  it("supports injected renderer failures", () => {
    const fixture = createInjectedRenderFrameSmokeFixture({
      failAt: "renderer",
    });

    expect(fixture.summary.ready).toBe(false);
    expect(fixture.summary.sections.rendererAssembly.ready).toBe(false);
    expect(fixture.summary.diagnosticSummary.byCode).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
      "mvpFrameReadiness.rendererAssemblyNotReady": 1,
    });
  });

  it("supports injected render-pass resource failures", () => {
    const fixture = createInjectedRenderFrameSmokeFixture({
      failAt: "renderPassResource",
    });

    expect(fixture.renderPass.ready).toBe(false);
    expect(fixture.renderPassRun.resources.diagnostics).toMatchObject([
      { code: "renderPassResource.missingPipeline" },
    ]);
    expect(fixture.summary.sections.renderPassAssembly.ready).toBe(false);
  });

  it("supports injected command execution failures", () => {
    const fixture = createInjectedRenderFrameSmokeFixture({
      failAt: "commandExecution",
    });

    expect(fixture.renderPassRun.execution.valid).toBe(false);
    expect(fixture.summary.sections.renderPassAssembly.ready).toBe(false);
    expect(fixture.summary.diagnosticSummary.byCode).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
    });
  });

  it("supports injected texture, finish, and submit failures", () => {
    const texture = createInjectedRenderFrameSmokeFixture({
      failAt: "texture",
    });
    const finish = createInjectedRenderFrameSmokeFixture({ failAt: "finish" });
    const submit = createInjectedRenderFrameSmokeFixture({ failAt: "submit" });

    expect(
      texture.frameExecution.sections.commandSubmissionMetrics.present,
    ).toBe(false);
    expect(finish.frameExecution.sections.submissionSmoke.ready).toBe(false);
    expect(finish.summary.sections.commandSubmissionMetrics.present).toBe(
      false,
    );
    expect(
      submit.frameExecution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
    expect(submit.summary.diagnosticSummary.byCode).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });

  it("supports stable multi-draw command planning", () => {
    const fixture = createInjectedRenderFrameSmokeFixture({ drawCount: 2 });

    expect(
      fixture.renderPassRun.commands.commands
        .filter((command) => command.kind === "draw")
        .map((command) => command.renderId),
    ).toEqual([9, 7]);
    expect(fixture.frameExecution.counts).toMatchObject({
      commands: 12,
      executedCommands: 12,
      drawCalls: 2,
    });
    expect(fixture.summary.counts).toMatchObject({
      plannedDraws: 2,
      commands: 12,
      executedCommands: 12,
    });
  });

  it("reports multi-draw missing resource failures", () => {
    const fixture = createInjectedRenderFrameSmokeFixture({
      drawCount: 2,
      failAt: "renderPassResource",
    });

    expect(fixture.renderPassRun.resources.valid).toBe(false);
    expect(fixture.renderPassRun.resources.diagnostics).toHaveLength(2);
    expect(
      fixture.renderPassRun.resources.diagnostics.map((diagnostic) =>
        "renderId" in diagnostic ? diagnostic.renderId : -1,
      ),
    ).toEqual([9, 7]);
  });
});
