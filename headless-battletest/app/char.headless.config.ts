import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["char-src/**/*.system.ts"],
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  render: { defaultCamera: false, defaultLight: false },
});
