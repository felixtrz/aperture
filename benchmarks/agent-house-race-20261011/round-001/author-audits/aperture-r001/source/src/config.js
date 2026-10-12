import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "browser",
  canvas: "#scene",
  render: {
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: true,
    tonemap: "aces",
    exposure: 1,
    sampleCount: 4,
    pixelRatio: 1,
    clearColor: [0.55, 0.7, 0.86, 1],
  },
  diagnostics: { level: "warn" },
});
