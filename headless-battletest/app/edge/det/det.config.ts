import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["edge/det/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
});
