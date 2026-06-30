import { defineApertureConfig, signal } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["pick/systems/**/*.system.ts"],
  signals: { clicks: signal.number(0), downs: signal.number(0), hovering: signal.boolean(false) },
  render: { defaultCamera: false, defaultLight: false },
});
