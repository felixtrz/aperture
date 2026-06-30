import { defineApertureConfig, signal } from "@aperture-engine/app/config";

// Conway's Game of Life as an ECS app — a non-3D, fully deterministic
// simulation (no RNG), ideal for headless invariant testing. One generation
// per fixed step; live cells are visualized as spawned cubes.
export default defineApertureConfig({
  mode: "headless",
  systems: ["life/systems/**/*.system.ts"],
  signals: {
    generation: signal.number(0),
    liveCount: signal.number(0),
    blinkerHorizontal: signal.boolean(true),
  },
  render: { clearColor: [0.02, 0.02, 0.03, 1], defaultCamera: false, defaultLight: false },
});
