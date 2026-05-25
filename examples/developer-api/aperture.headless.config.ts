import {
  asset,
  defineApertureConfig,
  signal,
} from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/aperture-base-color-checker.png", {
      preload: "background",
    }),
    decal: asset.texture("/assets/aperture-base-color-checker.png", {
      preload: "manual",
    }),
  },
  input: {
    actions: {
      select: [{ pointer: "primary" }, { keyboard: "Enter" }],
      jump: [{ keyboard: "Space" }],
    },
  },
  signals: {
    selectedEntity: signal.ref(null),
    gameplayMode: signal.string("edit"),
  },
  render: {
    defaultCamera: false,
    defaultLight: false,
  },
});
