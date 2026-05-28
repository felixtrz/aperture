import type { ApertureInputSummary, InputResourceBase } from "./types.js";

export function createInputResourceSummary(
  input: InputResourceBase,
): ApertureInputSummary {
  const actions: ApertureInputSummary["actions"] = {};

  for (const [name, action] of Object.entries(input.actions)) {
    if (action.kind === "button") {
      actions[name] = {
        kind: "button",
        pressed: action.pressed.value,
        value: action.value.value,
        down: action.down(),
        up: action.up(),
      };
      continue;
    }

    if (action.kind === "axis1d") {
      actions[name] = {
        kind: "axis1d",
        value: action.value.value,
        previous: action.previous(),
      };
      continue;
    }

    const previous = { x: 0, y: 0 };
    action.previous(previous);
    actions[name] = {
      kind: "axis2d",
      x: action.x.value,
      y: action.y.value,
      previous: [previous.x, previous.y],
    };
  }

  return {
    actions,
    pointer: {
      primary: {
        position: input.pointer.primary.position.value,
        pressed: input.pointer.primary.pressed.value,
      },
    },
    keyboard: input.keyboard.summary(),
    gamepads: input.gamepads.summary(),
    diagnostics: input.diagnostics(),
  };
}
