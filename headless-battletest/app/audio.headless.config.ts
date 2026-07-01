import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["audio-src/**/*.system.ts"],
  assets: { blip: asset.audio("/audio/blip.wav", { preload: "blocking" }) },
  render: { defaultCamera: false, defaultLight: false },
});
