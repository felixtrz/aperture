import { defineApertureConfig } from "@aperture-engine/app/config";

// Isolated physics probe: does the Rapier backend simulate in pure-Node
// headless? Enables the fixed-step clock via `physics`.
export default defineApertureConfig({
  mode: "headless",
  systems: ["phys-src/**/*.system.ts"],
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  render: { defaultCamera: false, defaultLight: false },
});
