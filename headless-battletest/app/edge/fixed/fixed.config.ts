import { defineApertureConfig, signal } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["edge/fixed/systems/**/*.system.ts"],
  signals: { fixedTicks: signal.number(0), updateTicks: signal.number(0), lastFixedDelta: signal.number(0) },
  physics: { backend: "rapier", gravity: [0, -25, 0] },
  render: { defaultCamera: false, defaultLight: false },
});
