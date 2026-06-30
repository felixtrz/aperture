import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  assets: { remote: asset.gltf("https://example.com/model.glb", { preload: "blocking" }) },
  render: { defaultCamera: false, defaultLight: false },
});
