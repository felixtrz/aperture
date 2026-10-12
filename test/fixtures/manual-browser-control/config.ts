import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#scene",
  systems: [],
  render: {
    cadence: "manual",
    bloom: { intensity: 0.03, threshold: 0.8, radiusPixels: 2 },
    maxPixelRatio: 1,
  },
});
