import { describe, expect, it } from "vitest";

import fpsConfig from "../../fps/aperture.config.js";
import {
  advanceInputResource,
  createInputResource,
  type InputAction,
  type InputAxis2dAction,
  type InputButtonAction,
} from "../../packages/app/src/input/state.js";

describe("Starter Kit FPS input config", () => {
  it("maps browser-standard gamepad axes to source FPS movement and look vectors", () => {
    const input = createInputResource(fpsConfig);

    advanceInputResource(input, [
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Standard Pad",
            mapping: "standard",
            connected: true,
            buttons: [],
            axes: [0, -1, 1, -1],
          },
        ],
      },
    ]);

    expect(axis2d(input.actions.move).y.value).toBe(1);
    expect(axis2d(input.actions.look).x.value).toBe(-1);
    expect(axis2d(input.actions.look).y.value).toBe(1);

    advanceInputResource(input, [
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Standard Pad",
            mapping: "standard",
            connected: true,
            buttons: [],
            axes: [0, 1, -1, 1],
          },
        ],
      },
    ]);

    expect(axis2d(input.actions.move).y.value).toBe(-1);
    expect(axis2d(input.actions.look).x.value).toBe(1);
    expect(axis2d(input.actions.look).y.value).toBe(-1);
  });

  it("maps source gamepad shoot and weapon-toggle inputs", () => {
    const input = createInputResource(fpsConfig);
    const buttons = Array.from({ length: 11 }, () => ({
      pressed: false,
      value: 0,
    }));
    buttons[7] = { pressed: true, value: 1 };
    buttons[10] = { pressed: true, value: 1 };

    advanceInputResource(input, [
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Standard Pad",
            mapping: "standard",
            connected: true,
            buttons,
            axes: [0, 0, 0, 0],
          },
        ],
      },
    ]);

    expect(button(input.actions.shoot).down()).toBe(true);
    expect(button(input.actions.switchWeapon).down()).toBe(true);

    const rightBumperOnly = Array.from({ length: 11 }, () => ({
      pressed: false,
      value: 0,
    }));
    rightBumperOnly[5] = { pressed: true, value: 1 };

    advanceInputResource(input, [
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Standard Pad",
            mapping: "standard",
            connected: true,
            buttons: rightBumperOnly,
            axes: [0, 0, 0, 0],
          },
        ],
      },
    ]);

    expect(button(input.actions.switchWeapon).pressed()).toBe(false);
  });

  it("maps the source middle mouse weapon-toggle input", () => {
    const input = createInputResource(fpsConfig);

    advanceInputResource(input, [
      {
        kind: "pointer",
        pointer: "middle",
        position: [0.5, 0.5],
        pressed: true,
      },
    ]);

    expect(button(input.actions.shoot).down()).toBe(false);
    expect(button(input.actions.switchWeapon).down()).toBe(true);
  });

  it("maps keyboard look helpers to the source camera action vector", () => {
    const input = createInputResource(fpsConfig);

    advanceInputResource(input, [
      { kind: "keyboard", code: "KeyL", pressed: true },
      { kind: "keyboard", code: "KeyI", pressed: true },
    ]);

    expect(axis2d(input.actions.look).x.value).toBe(-1);
    expect(axis2d(input.actions.look).y.value).toBe(1);

    advanceInputResource(input, [
      { kind: "keyboard", code: "KeyL", pressed: false },
      { kind: "keyboard", code: "KeyI", pressed: false },
      { kind: "keyboard", code: "KeyJ", pressed: true },
      { kind: "keyboard", code: "KeyK", pressed: true },
    ]);

    expect(axis2d(input.actions.look).x.value).toBe(1);
    expect(axis2d(input.actions.look).y.value).toBe(-1);
  });

  it("keeps pointer-lock mouse look on a virtual-only source action", () => {
    const input = createInputResource(fpsConfig);

    advanceInputResource(input, [
      { kind: "virtualAction", action: "mouseLook", x: -0.5, y: 0.25 },
    ]);

    expect(axis2d(input.actions.look).x.value).toBe(0);
    expect(axis2d(input.actions.look).y.value).toBe(0);
    expect(axis2d(input.actions.mouseLook).x.value).toBe(-0.5);
    expect(axis2d(input.actions.mouseLook).y.value).toBe(0.25);
  });
});

function axis2d(action: InputAction | undefined): InputAxis2dAction {
  if (action?.kind !== "axis2d") {
    throw new Error("expected axis2d action");
  }

  return action;
}

function button(action: InputAction | undefined): InputButtonAction {
  if (action?.kind !== "button") {
    throw new Error("expected button action");
  }

  return action;
}
