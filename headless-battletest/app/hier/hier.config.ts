import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["hier/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
});
