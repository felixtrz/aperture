import { asset, defineApertureConfig, input } from "@aperture-engine/app/config";

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
      sampleCube: asset.gltf(assetUrl("assets/sample-cube.glb"), {
        preload: "blocking",
        label: "Sample Cube",
      }),
    },
    input: {
      actions: {
        resetView: input.button([input.key("KeyR")]),
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
