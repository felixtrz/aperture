import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

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
  signals: {
    lap: signal.number(1),
    currentLapTime: signal.number(0),
    lastLapTime: signal.number(-1),
    bestLapTime: signal.number(-1),
    speed: signal.number(0),
    started: signal.boolean(false),
    // Published by vehicle.system for the main-thread audio driver (src/audio.ts).
    throttle: signal.number(0),
    driftIntensity: signal.number(0),
  },
  input: {
    actions: {
      // x = steer (+right), y = throttle (+forward). Mirrors Controls.js.
      drive: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft", "KeyA"],
          positiveX: ["ArrowRight", "KeyD"],
          negativeY: ["ArrowDown", "KeyS"],
          positiveY: ["ArrowUp", "KeyW"],
        }),
        input.gamepadStick("left"),
      ]),
    },
  },
  physics: {
    // main.js: worldSettings.gravity = [0, -9.81, 0]
    gravity: [0, -9.81, 0],
  },
  render: {
    // scene.background = 0xadb2ba
    clearColor: [0xad / 255, 0xb2 / 255, 0xba / 255, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    // renderer.toneMapping = ACESFilmicToneMapping, exposure 1.0, HalfFloat HDR.
    tonemap: "aces",
    exposure: 1.0,
    // UnrealBloomPass: strength 0.02, radius 0.02, threshold 0.5.
    bloom: { threshold: 0.5, intensity: 0.02, radiusPixels: 2 },
  },
  diagnostics: {
    level: "info",
  },
});
