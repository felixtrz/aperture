import { defineApertureConfig } from "@aperture-engine/app/config";

// A procedural-only headless app fixture: no external assets, so it boots in
// pure Node with no asset loader. Used by the headless config-loader and
// command tests.
export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
});
