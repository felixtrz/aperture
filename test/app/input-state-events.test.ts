import { describe, expect, it } from "vitest";

import { defineApertureConfig, input } from "@aperture-engine/app/config";
import {
  advanceInputResource,
  createInputResource,
  type InputAction,
  type InputAxis1dAction,
  type InputAxis2dAction,
  type InputButtonAction,
  type InputResourceBase,
} from "../../packages/app/src/input/state.js";

// Event-kind coverage for the input state resource: batch fan-out, pointer
// clamping, keyboard code fallback, gamepad snapshot replace semantics,
// virtual action composition, and reset semantics.

function createResource(): InputResourceBase {
  return createInputResource(
    defineApertureConfig({
      mode: "headless",
      input: {
        actions: {
          jump: input.button([input.key("Space")]),
          click: input.button([input.pointer("primary")]),
          secondaryClick: input.button([input.pointer("secondary")]),
          middleClick: input.button([input.pointer("middle")]),
          padJump: input.button([input.gamepadButton("south")]),
          fire: [input.key("KeyF")],
          virtualFire: input.button([input.virtual()]),
          throttle: input.axis1d([input.keyboard1d({ positive: ["KeyW"] })]),
          virtualThrottle: input.axis1d([input.virtual()]),
          move: input.axis2d([
            input.keyboard2d({ negativeX: ["KeyA"], positiveX: ["KeyD"] }),
          ]),
          virtualMove: input.axis2d([input.virtual()]),
        },
      },
    }),
  );
}

function requireButton(action: InputAction | undefined): InputButtonAction {
  if (action?.kind !== "button") {
    throw new Error("expected a button action");
  }
  return action;
}

function requireAxis1d(action: InputAction | undefined): InputAxis1dAction {
  if (action?.kind !== "axis1d") {
    throw new Error("expected an axis1d action");
  }
  return action;
}

function requireAxis2d(action: InputAction | undefined): InputAxis2dAction {
  if (action?.kind !== "axis2d") {
    throw new Error("expected an axis2d action");
  }
  return action;
}

describe("input state event handling", () => {
  it("applies nested batch events in order", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      {
        kind: "batch",
        events: [
          { kind: "keyboard", code: "Space", pressed: true },
          {
            kind: "batch",
            events: [
              {
                kind: "pointer",
                pointer: "primary",
                position: [0.25, 0.75],
                pressed: true,
              },
            ],
          },
        ],
      },
    ]);

    expect(requireButton(resource.actions.jump).pressed()).toBe(true);
    expect(resource.pointer.primary.position.value).toEqual([0.25, 0.75]);
    expect(resource.pointer.primary.pressed.value).toBe(true);
  });

  it("clamps pointer positions into [0, 1] and zeroes non-finite components", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      {
        kind: "pointer",
        pointer: "primary",
        position: [1.5, -0.25],
        pressed: true,
      },
    ]);

    expect(resource.pointer.primary.position.value).toEqual([1, 0]);
    expect(resource.pointer.primary.pressed.value).toBe(true);

    advanceInputResource(resource, [
      { kind: "pointer", pointer: "primary", position: [Number.NaN, 0.5] },
    ]);

    expect(resource.pointer.primary.position.value).toEqual([0, 0.5]);
    expect(resource.pointer.primary.pressed.value).toBe(true);
  });

  it("models secondary and middle pointer events", () => {
    const resource = createResource();
    const secondaryClick = requireButton(resource.actions.secondaryClick);
    const middleClick = requireButton(resource.actions.middleClick);

    advanceInputResource(resource, [
      {
        kind: "pointer",
        pointer: "secondary",
        position: [0.5, 0.5],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "middle",
        position: [0.25, 0.75],
        pressed: true,
      },
    ]);

    expect(resource.pointer.primary.position.value).toEqual([0, 0]);
    expect(resource.pointer.primary.pressed.value).toBe(false);
    expect(resource.pointer.secondary.position.value).toEqual([0.5, 0.5]);
    expect(resource.pointer.secondary.pressed.value).toBe(true);
    expect(resource.pointer.middle.position.value).toEqual([0.25, 0.75]);
    expect(resource.pointer.middle.pressed.value).toBe(true);
    expect(secondaryClick.down()).toBe(true);
    expect(middleClick.down()).toBe(true);
  });

  it("drives button actions from same-frame press and release edges", () => {
    const resource = createResource();
    const jump = requireButton(resource.actions.jump);
    const click = requireButton(resource.actions.click);
    const padJump = requireButton(resource.actions.padJump);

    advanceInputResource(resource, [
      { kind: "keyboard", code: "Space", pressed: true },
      { kind: "keyboard", code: "Space", pressed: false },
      {
        kind: "pointer",
        pointer: "primary",
        position: [0.5, 0.5],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "primary",
        position: [0.5, 0.5],
        pressed: false,
      },
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Pad",
            mapping: "standard",
            connected: true,
            buttons: [{ pressed: true, value: 1 }],
            axes: [0, 0, 0, 0],
          },
        ],
      },
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Pad",
            mapping: "standard",
            connected: true,
            buttons: [{ pressed: false, value: 0 }],
            axes: [0, 0, 0, 0],
          },
        ],
      },
    ]);

    expect(resource.keyboard.down("Space")).toBe(true);
    expect(resource.pointer.primary.pressedThisFrame.value).toBe(true);
    expect(resource.gamepads.primary?.down("south")).toBe(true);
    expect(jump.down()).toBe(true);
    expect(click.down()).toBe(true);
    expect(padJump.down()).toBe(true);

    advanceInputResource(resource);

    expect(jump.up()).toBe(true);
    expect(click.up()).toBe(true);
    expect(padJump.up()).toBe(true);
  });

  it("falls back to the keyboard key field and ignores empty codes", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      { kind: "keyboard", key: "KeyZ", pressed: true },
      { kind: "keyboard", code: "", key: "", pressed: true },
    ]);

    expect(resource.keyboard.pressed("KeyZ")).toBe(true);
    expect(resource.keyboard.pressedCodes()).toEqual(["KeyZ"]);
  });

  it("sums wheel samples within a frame and ignores non-finite deltas", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      { kind: "wheel", deltaX: 2, deltaY: 30 },
      { kind: "wheel", deltaX: -1, deltaY: 12 },
      { kind: "wheel", deltaX: Number.NaN, deltaY: Number.POSITIVE_INFINITY },
    ]);

    expect(resource.wheel.deltaX.value).toBe(1);
    expect(resource.wheel.deltaY.value).toBe(42);
  });

  it("clears the accumulated wheel delta on reset events", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      { kind: "wheel", deltaX: 5, deltaY: 9 },
      { kind: "reset", reason: "blur" },
    ]);

    expect(resource.wheel.deltaX.value).toBe(0);
    expect(resource.wheel.deltaY.value).toBe(0);
  });

  it("applies wheel events nested inside batches", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      {
        kind: "batch",
        events: [
          { kind: "wheel", deltaX: 0, deltaY: 7 },
          { kind: "batch", events: [{ kind: "wheel", deltaX: 3, deltaY: 1 }] },
        ],
      },
    ]);

    expect(resource.wheel.deltaX.value).toBe(3);
    expect(resource.wheel.deltaY.value).toBe(8);
  });

  it("merges gamepad snapshots when replace is false and replaces by default", () => {
    const resource = createResource();
    const pad = (index: number, x: number) => ({
      index,
      id: `Pad ${index}`,
      mapping: "standard" as const,
      connected: true,
      buttons: [{ pressed: false, value: 0 }],
      axes: [x, 0, 0, 0],
    });

    advanceInputResource(resource, [
      { kind: "gamepad", gamepads: [pad(0, 0.5), pad(1, 0.25)] },
    ]);

    expect(resource.gamepads.byIndex(0)?.connected).toBe(true);
    expect(resource.gamepads.byIndex(1)?.connected).toBe(true);
    expect(resource.gamepads.primary?.index).toBe(0);

    advanceInputResource(resource, [
      { kind: "gamepad", gamepads: [pad(1, 0.75)], replace: false },
    ]);

    expect(resource.gamepads.byIndex(0)?.connected).toBe(true);
    expect(resource.gamepads.byIndex(1)?.leftStick.x).toBe(0.75);
    expect(resource.gamepads.primary?.index).toBe(0);

    advanceInputResource(resource, [
      { kind: "gamepad", gamepads: [pad(1, 0.75)] },
    ]);

    expect(resource.gamepads.byIndex(0)).toBeNull();
    expect(resource.gamepads.primary?.index).toBe(1);
  });

  it("drives button actions from virtual action events", () => {
    const resource = createResource();
    const jump = requireButton(resource.actions.jump);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "jump", pressed: true },
    ]);

    expect(jump.pressed()).toBe(true);
    expect(jump.down()).toBe(true);

    advanceInputResource(resource);

    expect(jump.pressed()).toBe(true);
    expect(jump.down()).toBe(false);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "jump", value: false },
    ]);

    expect(jump.pressed()).toBe(false);
    expect(jump.up()).toBe(true);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "jump", value: 0.75 },
    ]);

    expect(jump.pressed()).toBe(true);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "jump", value: 0 },
    ]);

    expect(jump.pressed()).toBe(false);

    advanceInputResource(resource, [{ kind: "virtualAction", action: "jump" }]);

    expect(jump.pressed()).toBe(false);
  });

  it("keeps same-frame virtual press and release visible for one frame", () => {
    const resource = createResource();
    const jump = requireButton(resource.actions.jump);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "jump", pressed: true },
      { kind: "virtualAction", action: "jump", pressed: false },
    ]);

    expect(jump.pressed()).toBe(true);
    expect(jump.down()).toBe(true);

    advanceInputResource(resource);

    expect(jump.pressed()).toBe(false);
    expect(jump.up()).toBe(true);
  });

  it("drives axis1d actions from virtual values and pressed shorthands", () => {
    const resource = createResource();
    const throttle = requireAxis1d(resource.actions.throttle);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "throttle", value: 0.5 },
    ]);

    expect(throttle.read()).toBe(0.5);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "throttle", value: 4 },
    ]);

    expect(throttle.read()).toBe(1);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "throttle", pressed: false },
    ]);

    expect(throttle.read()).toBe(0);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "throttle", pressed: true },
    ]);

    expect(throttle.read()).toBe(1);
  });

  it("sums axis1d bindings with the virtual seed and clamps the result", () => {
    const resource = createResource();
    const throttle = requireAxis1d(resource.actions.throttle);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "throttle", value: 0.5 },
      { kind: "keyboard", code: "KeyW", pressed: true },
    ]);

    expect(throttle.read()).toBe(1);
    expect(throttle.previous()).toBe(0);
  });

  it("drives axis2d actions from virtual x/y components", () => {
    const resource = createResource();
    const move = requireAxis2d(resource.actions.move);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "move", x: 0.25 },
    ]);

    expect(move.x.value).toBe(0.25);
    expect(move.y.value).toBe(0);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "move", y: -3 },
    ]);

    expect(move.x.value).toBe(0.25);
    expect(move.y.value).toBe(-1);

    advanceInputResource(resource, [
      { kind: "keyboard", code: "KeyD", pressed: true },
    ]);

    expect(move.x.value).toBe(1);
    expect(move.y.value).toBe(-1);
  });

  it("drives actions declared with virtual-only bindings", () => {
    const resource = createResource();
    const fire = requireButton(resource.actions.virtualFire);
    const throttle = requireAxis1d(resource.actions.virtualThrottle);
    const move = requireAxis2d(resource.actions.virtualMove);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "virtualFire", pressed: true },
      { kind: "virtualAction", action: "virtualThrottle", value: 0.5 },
      { kind: "virtualAction", action: "virtualMove", x: -0.25, y: 0.75 },
    ]);

    expect(fire.down()).toBe(true);
    expect(throttle.read()).toBe(0.5);
    expect(move.x.value).toBe(-0.25);
    expect(move.y.value).toBe(0.75);
  });

  it("resolves raw binding-array actions as buttons", () => {
    const resource = createResource();
    const fire = requireButton(resource.actions.fire);

    advanceInputResource(resource, [
      { kind: "keyboard", code: "KeyF", pressed: true },
    ]);

    expect(fire.pressed()).toBe(true);
  });

  it("reports unknown virtual actions with a structured diagnostic", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "dash", pressed: true },
    ]);

    expect(resource.diagnostics()).toEqual([
      expect.objectContaining({
        code: "aperture.input.unknownAction",
        severity: "error",
        data: expect.objectContaining({
          action: "dash",
          available: expect.arrayContaining(["jump", "move"]),
        }),
      }),
    ]);

    advanceInputResource(resource);

    expect(resource.diagnostics()).toEqual([]);
  });

  it("releases keyboard, pointer, gamepad, and virtual state on reset", () => {
    const resource = createResource();
    const jump = requireButton(resource.actions.jump);
    const fire = requireButton(resource.actions.fire);

    advanceInputResource(resource, [
      { kind: "keyboard", code: "Space", pressed: true },
      {
        kind: "pointer",
        pointer: "primary",
        position: [0.5, 0.5],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "secondary",
        position: [0.25, 0.25],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "middle",
        position: [0.75, 0.75],
        pressed: true,
      },
      {
        kind: "gamepad",
        gamepads: [
          {
            index: 0,
            id: "Pad 0",
            mapping: "standard",
            connected: true,
            buttons: [{ pressed: true, value: 1 }],
            axes: [0, 0, 0, 0],
          },
        ],
      },
      { kind: "virtualAction", action: "fire", pressed: true },
    ]);

    expect(jump.pressed()).toBe(true);
    expect(fire.pressed()).toBe(true);
    expect(resource.gamepads.primary?.index).toBe(0);

    advanceInputResource(resource, [{ kind: "reset", reason: "blur" }]);

    expect(resource.keyboard.pressed("Space")).toBe(false);
    expect(resource.pointer.primary.pressed.value).toBe(false);
    expect(resource.pointer.primary.position.value).toEqual([0.5, 0.5]);
    expect(resource.pointer.secondary.pressed.value).toBe(false);
    expect(resource.pointer.secondary.position.value).toEqual([0.25, 0.25]);
    expect(resource.pointer.middle.pressed.value).toBe(false);
    expect(resource.pointer.middle.position.value).toEqual([0.75, 0.75]);
    expect(resource.gamepads.primary).toBeNull();
    expect(jump.pressed()).toBe(false);
    expect(fire.pressed()).toBe(false);

    advanceInputResource(resource, [
      { kind: "virtualAction", action: "fire", pressed: true },
    ]);

    expect(fire.pressed()).toBe(true);

    advanceInputResource(resource, [{ kind: "reset" }]);

    expect(fire.pressed()).toBe(false);
  });
});
