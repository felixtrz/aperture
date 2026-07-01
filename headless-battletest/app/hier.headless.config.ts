import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["hier-src/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
});
