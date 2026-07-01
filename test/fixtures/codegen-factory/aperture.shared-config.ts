import {
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

// Mirrors the scaffold's recommended pattern: input actions and signals are
// declared in a shared factory, invisible to a shallow AST parse of the
// config file that re-exports it (#68).
export function createApertureAppConfig(options: {
  readonly mode: "browser" | "headless";
}) {
  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser" ? { canvas: "#aperture" } : {}),
    signals: {
      score: signal.number(0),
      label: signal.string("ready"),
      goalReached: signal.boolean(false),
      selectedEntity: signal.ref(null),
    },
    input: {
      actions: {
        jump: input.button([input.key("Space")]),
        throttle: input.axis1d([input.keyboard1d({ positive: ["KeyW"] })]),
        move: input.axis2d([input.gamepadStick("left")]),
      },
    },
  });
}
