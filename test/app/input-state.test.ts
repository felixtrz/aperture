import { describe, expect, expectTypeOf, it } from "vitest";
import type { Signal } from "@preact/signals-core";

import { defineApertureConfig, input } from "@aperture-engine/app/config";
import type {
  InputActions,
  InputAxis1dAction,
  InputAxis2dAction,
  InputButtonAction,
} from "@aperture-engine/app/systems";
import { createApertureGeneratedActionTypes } from "@aperture-engine/vite-plugin";
import {
  advanceInputResource,
  createInputResource,
  createInputResourceSummary,
} from "../../packages/app/src/input/state.js";

declare module "@aperture-engine/app/systems" {
  interface ApertureGeneratedActionMap {
    readonly jump: InputButtonAction;
    readonly throttle: InputAxis1dAction;
    readonly move: InputAxis2dAction;
  }
}

describe("input state resource", () => {
  it("provides generated kind-specific action types", () => {
    expectTypeOf<InputActions["jump"]["value"]>().toEqualTypeOf<
      Signal<boolean>
    >();
    expectTypeOf<InputActions["throttle"]["value"]>().toEqualTypeOf<
      Signal<number>
    >();
    expectTypeOf<InputActions["move"]["x"]>().toEqualTypeOf<Signal<number>>();
    expectTypeOf<InputActions["move"]["y"]>().toEqualTypeOf<Signal<number>>();

    // @ts-expect-error button actions do not expose axis2d component signals.
    expectTypeOf<InputActions["jump"]["x"]>().toEqualTypeOf<Signal<number>>();
    // @ts-expect-error axis2d actions do not expose button edge methods.
    expectTypeOf<InputActions["move"]["down"]>().toEqualTypeOf<() => boolean>();
  });

  it("tracks keyboard held and edge state for one frame", () => {
    const resource = createInputResource(
      defineApertureConfig({
        mode: "headless",
        input: {
          actions: {
            jump: input.button([input.key("Space")]),
          },
        },
      }),
    );

    advanceInputResource(resource, [
      { kind: "keyboard", code: "Space", pressed: true },
    ]);

    const jump = resource.actions.jump;
    expect(resource.keyboard.pressed("Space")).toBe(true);
    expect(resource.keyboard.down("Space")).toBe(true);
    expect(jump?.kind).toBe("button");
    expect(jump?.kind === "button" ? jump.value.value : false).toBe(true);
    expect(jump?.kind === "button" ? jump.pressed() : false).toBe(true);
    expect(jump?.kind === "button" ? jump.down() : false).toBe(true);

    advanceInputResource(resource, [
      { kind: "keyboard", code: "Space", pressed: true },
    ]);

    expect(resource.keyboard.pressed("Space")).toBe(true);
    expect(resource.keyboard.down("Space")).toBe(false);
    expect(jump?.kind === "button" ? jump.down() : true).toBe(false);

    advanceInputResource(resource, [
      { kind: "keyboard", code: "Space", pressed: false },
    ]);

    expect(resource.keyboard.pressed("Space")).toBe(false);
    expect(resource.keyboard.up("Space")).toBe(true);
    expect(jump?.kind === "button" ? jump.up() : false).toBe(true);

    advanceInputResource(resource);

    expect(resource.keyboard.up("Space")).toBe(false);
    expect(jump?.kind === "button" ? jump.up() : true).toBe(false);
  });

  it("composes keyboard and standard gamepad state into typed actions", () => {
    const resource = createInputResource(
      defineApertureConfig({
        mode: "headless",
        input: {
          actions: {
            move: input.axis2d([
              input.keyboard2d({
                negativeX: ["KeyA"],
                positiveX: ["KeyD"],
              }),
              input.gamepadStick("left"),
            ]),
            jump: input.button([input.gamepadButton("south")]),
          },
        },
      }),
    );

    advanceInputResource(resource, [
      { kind: "keyboard", code: "KeyD", pressed: true },
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Xbox Controller",
            mapping: "standard",
            connected: true,
            buttons: [{ pressed: true, touched: true, value: 1 }],
            axes: [0.7, 0.05, 0, 0],
          },
        ],
      },
    ]);

    const move = resource.actions.move;
    const jump = resource.actions.jump;
    expect(resource.gamepads.primary?.index).toBe(0);
    expect(resource.gamepads.primary?.down("south")).toBe(true);
    expect(move?.kind).toBe("axis2d");
    expect(move?.kind === "axis2d" ? move.x.value : 0).toBe(1);
    expect(move?.kind === "axis2d" ? move.y.value : 1).toBe(0);
    expect(jump?.kind === "button" ? jump.down() : false).toBe(true);

    advanceInputResource(resource, [
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Xbox Controller",
            mapping: "standard",
            connected: false,
          },
        ],
      },
    ]);

    expect(resource.gamepads.primary).toBeNull();
    expect(jump?.kind === "button" ? jump.up() : false).toBe(true);
  });

  it("reports unsupported gamepad mappings instead of driving actions", () => {
    const resource = createInputResource(
      defineApertureConfig({
        mode: "headless",
        input: {
          actions: {
            jump: input.button([input.gamepadButton("south")]),
          },
        },
      }),
    );

    advanceInputResource(resource, [
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Custom Pad",
            mapping: "xinput-custom",
            connected: true,
            buttons: [{ pressed: true, value: 1 }],
          },
        ],
      },
    ]);

    const summary = createInputResourceSummary(resource);
    expect(summary.actions.jump).toMatchObject({
      kind: "button",
      pressed: false,
      value: false,
    });
    expect(summary.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "aperture.input.gamepad.unsupportedMapping",
        }),
      ]),
    );
  });

  it("validates action descriptors and generates action map declarations", () => {
    expect(() =>
      defineApertureConfig({
        mode: "headless",
        input: {
          actions: {
            jump: input.button([]),
          },
        },
      }),
    ).toThrow(/must declare at least one binding/);

    const declarations = createApertureGeneratedActionTypes(
      [
        `import { defineApertureConfig, input } from "@aperture-engine/app/config";`,
        `export default defineApertureConfig({`,
        `  mode: "headless",`,
        `  input: {`,
        `    actions: {`,
        `      jump: input.button([input.key("Space")]),`,
        `      throttle: input.axis1d([input.keyboard1d({ positive: ["KeyW"] })]),`,
        `      move: input.axis2d([input.gamepadStick("left")]),`,
        `    },`,
        `  },`,
        `});`,
      ].join("\n"),
    );

    expect(declarations).toContain("readonly jump: InputButtonAction");
    expect(declarations).toContain("readonly throttle: InputAxis1dAction");
    expect(declarations).toContain("readonly move: InputAxis2dAction");
  });
});
