import { defineApertureConfig } from "@aperture-engine/app/config";

// A headless config whose system glob matches a module that lacks a default
// export, used to assert the loader surfaces a discovery diagnostic instead of
// crashing.
export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
});
