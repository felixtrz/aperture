import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["wgsl-src/**/*.system.ts"],
  assets: { water: asset.shader("/shaders/water.wgsl", { preload: "blocking" }) },
  render: { defaultCamera: false, defaultLight: false },
});
