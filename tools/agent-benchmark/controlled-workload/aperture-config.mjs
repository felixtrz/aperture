import { defineApertureConfig } from "@aperture-engine/app/config";
import workload from "./workload.json";

const settings = workload.settings;
export default defineApertureConfig({
  mode: "browser",
  canvas: "#scene",
  systems: [],
  render: {
    cadence: "manual",
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: false,
    clearColor: settings.clearColor,
    pixelRatio: settings.pixelRatio,
    maxPixelRatio: settings.pixelRatio,
    sampleCount: settings.sampleCount,
    tonemap: settings.tonemap,
    exposure: settings.exposure,
    geometryInspection: { maxRetainedBytes: 64 * 1024 * 1024 },
  },
  diagnostics: { level: "warn" },
});
