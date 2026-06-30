import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["multicam/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
});
