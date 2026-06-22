import {
  asset,
  defineApertureConfig,
  signal,
} from "@aperture-engine/app/config";
import { HERO_STORY_START_PHASE } from "./src/lib/hero-story.js";

const model = (name: string) =>
  asset.gltf(`${import.meta.env.BASE_URL}models/${name}.glb`, {
    preload: "blocking",
  });

// Every Kenney tile/prop the layout can reference, keyed by its model id so
// systems resolve it with `this.assets.gltf(id)`.
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
  "vehicle-truck-red",
  "stall-food",
] as const;

const modelAssets = Object.fromEntries(MODEL_IDS.map((id) => [id, model(id)]));

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    ...modelAssets,
  },
  signals: {
    heroMoment: signal.string("ecs-native"),
    heroPhase: signal.number(HERO_STORY_START_PHASE),
  },
  render: {
    // The town now floats with no ground plane, so a deep background makes the
    // colorful tiles pop (like Kenney's own screenshot). The day/night cycle
    // will drive a sky gradient here in a later pass.
    clearColor: [0.07, 0.09, 0.13, 1],
    defaultCamera: false,
    defaultLight: false,
    cadence: "demand",
    sampleCount: 4,
    maxPixelRatio: 2,
    deviceProfiles: [
      {
        label: "mobile",
        maxViewportWidth: 760,
        minDevicePixelRatio: 2,
        sampleCount: 1,
        maxPixelRatio: 1.5,
        bloom: { threshold: 1.05, intensity: 0.035, radius: 0.1, levels: 1 },
      },
    ],
    tonemap: "aces",
    exposure: 1,
    // Gentle bloom now; the night beat will lean on this for glowing windows.
    bloom: { threshold: 0.82, intensity: 0.055, radius: 0.14, levels: 2 },
  },
  diagnostics: {
    level: "info",
  },
});
