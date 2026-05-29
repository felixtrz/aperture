import {
  asset,
  defineApertureConfig,
  input,
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
    decal: asset.texture("/assets/aperture-base-color-checker.png", {
      preload: "manual",
    }),
    generatedWater: asset.shader("/shaders/generated-water.wgsl", {
      preload: "blocking",
    }),
  },
  signals: {
    selectedEntity: signal.ref(null),
    gameplayMode: signal.string("edit"),
  },
  input: {
    actions: {
      select: input.button([input.pointer("primary"), input.key("Enter")]),
      jump: input.button([input.key("Space")]),
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: false,
    defaultLight: false,
  },
  diagnostics: {
    level: "warn",
  },
});
