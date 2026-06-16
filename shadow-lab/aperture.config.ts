import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { BLOOM } from "./src/lib/tuning.js";

// Racing static-scene shadow test: the parked racing app's STATIC scene (track
// pieces, decorations, parked NPC trucks) — all generic glTF meshes — lit by one
// directional shadow-casting sun. Proves the shadow fixes (wgpu depth
// convention, back-face caster rendering, caster-driven ortho) work with real
// glTF content, not just the synthetic cube.
const gltf = (name: string) =>
  asset.gltf(`/models/${name}.glb`, { preload: "blocking" });

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    "vehicle-truck-yellow": gltf("vehicle-truck-yellow"),
    "vehicle-truck-green": gltf("vehicle-truck-green"),
    "vehicle-truck-purple": gltf("vehicle-truck-purple"),
    "vehicle-truck-red": gltf("vehicle-truck-red"),
    "track-straight": gltf("track-straight"),
    "track-corner": gltf("track-corner"),
    "track-bump": gltf("track-bump"),
    "track-finish": gltf("track-finish"),
    "decoration-empty": gltf("decoration-empty"),
    "decoration-forest": gltf("decoration-forest"),
    "decoration-tents": gltf("decoration-tents"),
  },
  render: {
    // scene.background = 0xadb2ba (racing main.js)
    clearColor: [0xad / 255, 0xb2 / 255, 0xba / 255, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    tonemap: "aces",
    exposure: 1.0,
    // UnrealBloomPass: strength 0.02, radius 0.02, threshold 0.5.
    bloom: {
      threshold: BLOOM.threshold,
      intensity: BLOOM.strength,
      radiusPixels: 8,
      levels: 5,
    },
  },
  diagnostics: {
    level: "info",
  },
});
