import { defineApertureConfig, signal } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["spatial/systems/**/*.system.ts"],
  signals: { rayHitDist: signal.number(-1), overlapCount: signal.number(-1), closestDist: signal.number(-1) },
  render: { defaultCamera: false, defaultLight: false },
});
