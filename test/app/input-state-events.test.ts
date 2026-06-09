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
          fire: [input.key("KeyF")],
          throttle: input.axis1d([input.keyboard1d({ positive: ["KeyW"] })]),
          move: input.axis2d([
            input.keyboard2d({ negativeX: ["KeyA"], positiveX: ["KeyD"] }),
          ]),
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

  it("ignores non-primary pointer events", () => {
    const resource = createResource();

    advanceInputResource(resource, [
      {
        kind: "pointer",
        pointer: "secondary",
        position: [0.5, 0.5],
        pressed: true,
      },
    ]);

    expect(resource.pointer.primary.position.value).toEqual([0, 0]);
    expect(resource.pointer.primary.pressed.value).toBe(false);
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
