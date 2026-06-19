import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";
import { STARTING_CASH, STRUCTURES } from "./src/lib/city-data.js";

const model = (name: string) =>
  asset.gltf(`/models/${name}.glb`, { preload: "blocking" });

const sound = (name: string, durationHint: number) =>
  asset.audio(`/sounds/${name}.ogg`, { preload: "blocking", durationHint });

// One GLB asset per structure, keyed by its id so systems resolve it with
// `this.assets.gltf(structure.id)`.
const structureAssets = Object.fromEntries(
  STRUCTURES.map((structure) => [structure.id, model(structure.id)]),
);

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    ...structureAssets,
    "placement-a": sound("placement-a", 0.4),
    "placement-b": sound("placement-b", 0.4),
    "placement-c": sound("placement-c", 0.4),
    "placement-d": sound("placement-d", 0.4),
    "removal-a": sound("removal-a", 0.4),
    "removal-b": sound("removal-b", 0.4),
    "removal-c": sound("removal-c", 0.4),
    "removal-d": sound("removal-d", 0.4),
    rotate: sound("rotate", 0.3),
    toggle: sound("toggle", 0.2),
    ambience: sound("ambience", 8),
  },
  signals: {
    // data_map.gd: cash starts at 10000.
    cash: signal.number(STARTING_CASH),
    structureIndex: signal.number(0),
    structureName: signal.string(STRUCTURES[0]?.name ?? ""),
    structurePrice: signal.number(STRUCTURES[0]?.price ?? 0),
    cellCount: signal.number(0),
    cameraZoom: signal.number(30),
    // Grid cell currently under the cursor, for the HUD coordinate readout.
    hoverX: signal.number(0),
    hoverZ: signal.number(0),
  },
  audio: true,
  input: {
    actions: {
      // WASD pans the camera focus (view.gd camera_left/right/forward/back).
      pan: input.axis2d([
        input.keyboard2d({
          negativeX: ["KeyA"],
          positiveX: ["KeyD"],
          negativeY: ["KeyW"],
          positiveY: ["KeyS"],
        }),
        input.gamepadStick("left"),
      ]),
      // Q / E cycle the selected structure (structure_previous / structure_next).
      toggleNext: input.button([
        input.key("KeyE"),
        input.gamepadButton("rightBumper"),
      ]),
      togglePrev: input.button([
        input.key("KeyQ"),
        input.gamepadButton("leftBumper"),
      ]),
      // DEL removes the structure under the cursor (plus friendly aliases).
      demolish: input.button([
        input.key("Delete"),
        input.key("Backspace"),
        input.key("KeyX"),
        input.gamepadButton("west"),
      ]),
      // Zoom the camera in/out. The source uses the scroll wheel only (wired
      // through the HUD command channel); these keys/triggers are an added
      // binding so zoom also works without a wheel and is driveable headlessly.
      zoomIn: input.button([
        input.key("Equal"),
        input.key("NumpadAdd"),
        input.gamepadButton("rightTrigger"),
      ]),
      zoomOut: input.button([
        input.key("Minus"),
        input.key("NumpadSubtract"),
        input.gamepadButton("leftTrigger"),
      ]),
      // F snaps the camera focus back to the origin (camera_center).
      center: input.button([input.key("KeyF"), input.gamepadButton("north")]),
      // R clears the whole city (an addition over the source; handy for demos).
      reset: input.button([input.key("KeyR")]),
    },
  },
  render: {
    // main-environment.tres background_color.
    clearColor: [0.56, 0.59, 0.67, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
    tonemap: "aces",
    exposure: 1,
    // Approximate the source environment glow (glow_intensity 2, low levels).
    bloom: { threshold: 0.8, intensity: 0.05, radiusPixels: 2 },
  },
  diagnostics: {
    level: "info",
  },
});
