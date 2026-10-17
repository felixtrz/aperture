import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  render: {
    defaultCamera: false,
    defaultLight: false,
    tonemap: "aces",
    exposure: 1,
    sampleCount: 4,
    bloom: { threshold: 0.8, intensity: 0.04, radiusPixels: 2 },
  },
});
