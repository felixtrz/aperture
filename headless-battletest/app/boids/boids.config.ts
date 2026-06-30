import { defineApertureConfig, signal } from "@aperture-engine/app/config";

// A headless-first deterministic flocking simulation. No assets, no physics,
// no browser — pure ECS + 3D math, ideal for the headless validation loop.
export default defineApertureConfig({
  mode: "headless",
  systems: ["boids/systems/**/*.system.ts"],
  signals: {
    boidCount: signal.number(0),
    avgSpeed: signal.number(0),
    centerX: signal.number(0),
    centerZ: signal.number(0),
  },
  render: { clearColor: [0.02, 0.03, 0.05, 1], defaultCamera: false, defaultLight: false },
});
