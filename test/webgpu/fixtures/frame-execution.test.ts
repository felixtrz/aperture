import { describe, expect, it } from "vitest";

import { createFrameExecutionSmokeFixture } from "./frame-execution.js";

describe("frame execution smoke fixture", () => {
  it("builds a ready injected frame execution path", () => {
    const fixture = createFrameExecutionSmokeFixture();

    expect(fixture.assembly.valid).toBe(true);
    expect(fixture.assembly.texture.valid).toBe(true);
    expect(fixture.assembly.encoder?.valid).toBe(true);
    expect(fixture.assembly.begin?.pass).not.toBeNull();
    expect(fixture.assembly.finish?.resource?.resourceKey).toBe(
      "command-buffer:fixture-frame",
    );
    expect(fixture.assembly.submit?.submitted).toBe(1);
    expect(fixture.boundarySmoke.ready).toBe(true);
    expect(fixture.submissionSmoke.ready).toBe(true);
    expect(fixture.events).toEqual([
      "begin",
      "draw",
      "end",
      "finish",
      "submit:1",
    ]);
  });

  it("can inject a texture acquisition failure", () => {
    const fixture = createFrameExecutionSmokeFixture({ failAt: "texture" });

    expect(fixture.assembly.valid).toBe(false);
    expect(fixture.assembly.texture.diagnostics).toMatchObject([
      { code: "currentTextureView.missingTextureView" },
    ]);
    expect(fixture.assembly.attachments).toBeNull();
    expect(fixture.boundarySmoke.sections.texture.ready).toBe(false);
    expect(fixture.submissionSmoke.sections.attachments.present).toBe(false);
  });

  it("can inject execution and submit failures", () => {
    const executeFailure = createFrameExecutionSmokeFixture({
      failAt: "execute",
    });
    const submitFailure = createFrameExecutionSmokeFixture({
      failAt: "submit",
    });

    expect(executeFailure.assembly.execution?.diagnostics).toMatchObject([
      { code: "renderPassCommandExecutor.missingMethod", method: "draw" },
    ]);
    expect(executeFailure.boundarySmoke.sections.execution.ready).toBe(false);
    expect(submitFailure.assembly.submit?.diagnostics).toMatchObject([
      { code: "queueSubmit.missingSubmit" },
    ]);
    expect(submitFailure.submissionSmoke.sections.submit.ready).toBe(false);
  });
});
