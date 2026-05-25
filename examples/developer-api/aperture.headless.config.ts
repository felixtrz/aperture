import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/aperture-base-color-checker.png", {
      preload: "background",
    }),
  },
  render: {
    defaultCamera: false,
    defaultLight: false,
  },
});
