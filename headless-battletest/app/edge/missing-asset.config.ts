import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  assets: { ghost: asset.gltf("/assets/this-does-not-exist.glb", { preload: "blocking" }) },
  render: { defaultCamera: false, defaultLight: false },
});
