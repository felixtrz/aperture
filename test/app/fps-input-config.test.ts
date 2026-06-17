import { describe, expect, it } from "vitest";

import fpsConfig from "../../fps/aperture.config.js";
import {
  advanceInputResource,
  createInputResource,
  type InputAction,
  type InputAxis2dAction,
} from "../../packages/app/src/input/state.js";

describe("Starter Kit FPS input config", () => {
  it("maps browser-standard gamepad Y axes to FPS forward and look-up", () => {
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
            axes: [0, -1, 0, -1],
          },
        ],
      },
    ]);

    expect(axis2d(input.actions.move).y.value).toBe(1);
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
            axes: [0, 1, 0, 1],
          },
        ],
      },
    ]);

    expect(axis2d(input.actions.move).y.value).toBe(-1);
    expect(axis2d(input.actions.look).y.value).toBe(-1);
  });
});

function axis2d(action: InputAction | undefined): InputAxis2dAction {
  if (action?.kind !== "axis2d") {
    throw new Error("expected axis2d action");
  }

  return action;
}
