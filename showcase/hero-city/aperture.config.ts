import { asset, defineApertureConfig } from "@aperture-engine/app/config";

const model = (name: string) =>
  asset.gltf(`/models/${name}.glb`, { preload: "blocking" });

// Every Kenney tile the layout can reference, keyed by its model id so systems
// resolve it with `this.assets.gltf(id)`.
const MODEL_IDS = [
  "road-straight",
  "road-straight-lightposts",
  "road-corner",
  "road-intersection",
  "road-split",
  "pavement",
  "pavement-fountain",
  "building-small-a",
  "building-small-b",
  "building-small-c",
  "building-small-d",
  "building-garage",
  "grass",
  "grass-trees",
  "grass-trees-tall",
] as const;

const modelAssets = Object.fromEntries(
  MODEL_IDS.map((id) => [id, model(id)]),
);

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    ...modelAssets,
  },
  render: {
    // The town now floats with no ground plane, so a deep background makes the
    // colorful tiles pop (like Kenney's own screenshot). The day/night cycle
    // will drive a sky gradient here in a later pass.
    clearColor: [0.07, 0.09, 0.13, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
    tonemap: "aces",
    exposure: 1,
    // Gentle bloom now; the night beat will lean on this for glowing windows.
    bloom: { threshold: 0.8, intensity: 0.06, radiusPixels: 2 },
  },
  diagnostics: {
    level: "info",
  },
});
