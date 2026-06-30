import { asset, defineApertureConfig, signal } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["anim/systems/**/*.system.ts"],
  assets: { cube: asset.gltf("/models/cube.animation.glb", { preload: "blocking", label: "Animated Cube" }) },
  signals: { clips: signal.number(0) },
  render: { defaultCamera: false, defaultLight: false },
});
