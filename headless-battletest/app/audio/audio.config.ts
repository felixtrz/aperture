import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["audio/systems/**/*.system.ts"],
  audio: true,
  assets: { beep: asset.audio("/audio/beep.ogg", { label: "Beep" }) },
  render: { defaultCamera: false, defaultLight: false },
});
