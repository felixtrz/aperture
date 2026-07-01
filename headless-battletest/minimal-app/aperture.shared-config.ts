import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";

interface ApertureAppConfigOptions {
  readonly mode: "browser" | "headless";
  readonly canvas?: string;
}

export function createApertureAppConfig(options: ApertureAppConfigOptions) {
  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser"
      ? { canvas: options.canvas ?? "#aperture" }
      : {}),
    systems: ["src/systems/**/*.system.ts"],
    signals: {
      selectedEntity: signal.ref(null),
    },
    input: {
      actions: {
        select: input.button([input.pointer("primary"), input.key("Enter")]),
      },
    },
    render: {
      clearColor: [0.03, 0.035, 0.04, 1],
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
