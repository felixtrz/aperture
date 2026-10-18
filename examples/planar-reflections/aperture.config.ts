import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  render: {
    cadence: "demand",
    defaultCamera: false,
    defaultLight: false,
    tonemap: "aces",
    exposure: 1,
    sampleCount: 4,
    maxPixelRatio: 1,
    planarReflection: {
      height: 0,
      strength: 0.24,
      distortionFrequency: 4,
      tint: [0.28, 0.75, 0.78],
      resolutionScale: 0.65,
      distortion: 0.002,
      blurPixels: 1,
    },
    ssao: { radiusPixels: 8, intensity: 0.35, power: 1.1, sampleCount: 8 },
    bloom: { threshold: 1.2, intensity: 0.02, radiusPixels: 2 },
  },
});
