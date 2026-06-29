import { defineApertureConfig } from "@aperture-engine/app/config";

// A non-headless config used to assert the loader rejects mode !== "headless".
export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
});
