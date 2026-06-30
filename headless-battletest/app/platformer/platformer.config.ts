import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";

// A complete side-scrolling platformer level with vertical geometry (solid
// platforms, a pit, fall-death) — developed and debugged entirely through the
// headless loop. Demonstrates a non-trivial character controller in pure Node.
export default defineApertureConfig({
  mode: "headless",
  systems: ["platformer/systems/**/*.system.ts"],
  signals: {
    playerX: signal.number(0),
    playerY: signal.number(0),
    grounded: signal.boolean(false),
    coins: signal.number(0),
    deaths: signal.number(0),
    won: signal.boolean(false),
  },
  input: {
    actions: {
      move: input.axis2d([input.gamepadStick("left")]),
      jump: input.button([input.key("Space")]),
    },
  },
  render: { clearColor: [0.05, 0.07, 0.1, 1], defaultCamera: false, defaultLight: false },
});
