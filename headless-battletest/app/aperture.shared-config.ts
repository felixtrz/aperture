import { asset, defineApertureConfig, input, signal } from "@aperture-engine/app/config";

interface ApertureAppConfigOptions {
  readonly mode: "browser" | "headless";
  readonly baseUrl: string;
  readonly canvas?: string;
}

export function createApertureAppConfig(options: ApertureAppConfigOptions) {
  const assetUrl = (path: string) => `${options.baseUrl}${path}`;

  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser"
      ? { canvas: options.canvas ?? "#aperture" }
      : {}),
    systems: ["src/systems/**/*.system.ts"],
    assets: {
      goal: asset.gltf(assetUrl("assets/goal-cube.glb"), {
        preload: "blocking",
        label: "Goal Cube",
      }),
    },
    signals: {
      score: signal.number(0),
      playerX: signal.number(0),
      goalReached: signal.boolean(false),
      coins: signal.number(0),
      hits: signal.number(0),
      hazardX: signal.number(0),
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
        jump: input.button([
          input.key("Space"),
          input.key("KeyW"),
          input.gamepadButton("south"),
        ]),
        reset: input.button([input.key("KeyR")]),
        dash: input.button([
          input.key("ShiftLeft"),
          input.gamepadButton("east"),
        ]),
      },
    },
    render: {
      clearColor: [0.08, 0.12, 0.16, 1],
      defaultCamera: false,
      defaultLight: false,
      sampleCount: 4,
      maxPixelRatio: 2,
    },
    diagnostics: {
      level: "info",
    },
  });
}
