import { describe, expect, it } from "vitest";
import {
  applyApertureHeadlessInjectStep,
  parseApertureHeadlessInject,
} from "@aperture-engine/cli";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { defineApertureConfig, input } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

const cubeSystem: ApertureSystemModule = {
  default: class CubeScene extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
        fovYDegrees: 60,
      });
      this.spawn.mesh({
        key: "cube",
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  },
};

async function createRunner() {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
      input: {
        actions: { jump: input.button([input.key("Space")]) },
      },
    }),
    systems: [cubeSystem],
  });
}

describe("parseApertureHeadlessInject (P1.5)", () => {
  it("parses a single step and an array of steps", () => {
    expect(parseApertureHeadlessInject('{"pointer":{"position":[0.25,0.5]}}')).toEqual(
      [{ pointer: { position: [0.25, 0.5] } }],
    );
    expect(
      parseApertureHeadlessInject('[{"atFrame":2,"actions":{"jump":true}}]'),
    ).toEqual([{ atFrame: 2, actions: { jump: true } }]);
  });

  it("rejects malformed JSON and bad shapes with aperture.headless.invalidInject", () => {
    expect(() => parseApertureHeadlessInject("not json")).toThrowError(
      expect.objectContaining({ code: "aperture.headless.invalidInject" }),
    );
    expect(() =>
      parseApertureHeadlessInject('{"pointer":{"position":[1]}}'),
    ).toThrowError(
      expect.objectContaining({ code: "aperture.headless.invalidInject" }),
    );
    expect(() =>
      parseApertureHeadlessInject('{"atFrame":-1}'),
    ).toThrowError(
      expect.objectContaining({ code: "aperture.headless.invalidInject" }),
    );
  });
});

describe("applyApertureHeadlessInjectStep (P1.5)", () => {
  it("sets pointer position and pressed state", async () => {
    const runner = await createRunner();

    applyApertureHeadlessInjectStep(runner.app.context.input, {
      pointer: { position: [0.25, 0.75], pressed: true },
    });

    expect(runner.app.context.input.pointer.primary.position.value).toEqual([
      0.25, 0.75,
    ]);
    expect(runner.app.context.input.pointer.primary.pressed.value).toBe(true);
  });

  it("presses a button action", async () => {
    const runner = await createRunner();

    applyApertureHeadlessInjectStep(runner.app.context.input, {
      actions: { jump: true },
    });

    const jump = runner.app.context.input.actions["jump"];
    expect(jump?.kind).toBe("button");
    expect(jump?.value.value).toBe(true);
  });

  it("rejects an unknown action", async () => {
    const runner = await createRunner();

    expect(() =>
      applyApertureHeadlessInjectStep(runner.app.context.input, {
        actions: { nope: true },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "aperture.headless.invalidInject" }),
    );
  });
});
