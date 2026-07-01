import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["fx-src/**/*.system.ts"],
  assets: {
    spark: asset.particleEffect({
      label: "Spark",
      main: {
        maxParticles: 256,
        duration: 2,
        startLifetime: { min: 1, max: 2 },
        startSize: { min: 0.1, max: 0.3 },
      },
      emission: { rateOverTime: 50 },
    }),
  },
  render: { defaultCamera: false, defaultLight: false },
});
