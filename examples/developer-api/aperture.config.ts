import {
  asset,
  defineApertureConfig,
  signal,
} from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/aperture-base-color-checker.png", {
      preload: "background",
    }),
  },
  signals: {
    selectedEntity: signal.ref(null),
    gameplayMode: signal.string("edit"),
  },
  input: {
    actions: {
      select: [{ pointer: "primary" }],
      jump: [{ keyboard: "Space" }],
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
  },
  diagnostics: {
    level: "warn",
  },
});
