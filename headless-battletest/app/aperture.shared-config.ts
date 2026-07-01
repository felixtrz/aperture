import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";

// Starfall — a deterministic star-catcher used to battle-test the headless flow.
//
// Design constraints that make it a good headless subject:
//  - Procedural only (no external assets) → boots in pure Node with zero
//    placeholder warnings and identical asset closure in headed/headless.
//  - All randomness flows through context.random; all timing through delta /
//    context.time → bit-identical replay under a fixed --seed.
//  - Runtime spawn AND despawn (stars) → snapshot entity counts change over time.
//  - One axis2d action (move basket) + one button (drop a "magnet" pulse) →
//    exercises both input paths.
interface StarfallOptions {
  readonly mode: "browser" | "headless";
  readonly baseUrl: string;
  readonly canvas?: string;
}

export function createStarfallConfig(options: StarfallOptions) {
  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser"
      ? { canvas: options.canvas ?? "#aperture" }
      : {}),
    systems: ["src/systems/**/*.system.ts"],
    signals: {
      score: signal.number(0),
      missed: signal.number(0),
      activeStars: signal.number(0),
      basketX: signal.number(0),
      magnetActive: signal.boolean(false),
      lastCatchFrame: signal.number(-1),
      // Progression: combo multiplier, level (ramps difficulty), game-over.
      combo: signal.number(0),
      bestCombo: signal.number(0),
      multiplier: signal.number(1),
      level: signal.number(1),
      gameOver: signal.boolean(false),
    },
    input: {
      actions: {
        move: input.axis2d([
          input.keyboard2d({
            negativeX: ["ArrowLeft", "KeyA"],
            positiveX: ["ArrowRight", "KeyD"],
          }),
          input.gamepadStick("left"),
        ]),
        magnet: input.button([
          input.key("Space"),
          input.gamepadButton("south"),
        ]),
      },
    },
    render: {
      // NOTE: render.clearColor here would be a no-op (see FINDINGS F1); the
      // real background is set per-camera in setup.system.ts via spawn.camera.
      defaultCamera: false,
      defaultLight: false,
      sampleCount: 4,
    },
    diagnostics: { level: "info" },
  });
}
