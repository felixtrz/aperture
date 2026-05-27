import {
  asset,
  defineApertureConfig,
  signal,
} from "@aperture-engine/app/config";
import { TOTAL_GEMS } from "./src/level.js";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    hero: asset.gltf("/assets/kenney/character-ooli.glb", {
      preload: "blocking",
    }),
    block: asset.gltf("/assets/kenney/block-grass.glb", {
      preload: "blocking",
    }),
    blockLong: asset.gltf("/assets/kenney/block-grass-long.glb", {
      preload: "blocking",
    }),
    blockLowLong: asset.gltf("/assets/kenney/block-grass-low-long.glb", {
      preload: "blocking",
    }),
    blockLarge: asset.gltf("/assets/kenney/block-grass-large.glb", {
      preload: "blocking",
    }),
    platform: asset.gltf("/assets/kenney/platform.glb", {
      preload: "blocking",
    }),
    platformOverhang: asset.gltf("/assets/kenney/platform-overhang.glb", {
      preload: "blocking",
    }),
    coin: asset.gltf("/assets/kenney/coin-gold.glb", {
      preload: "blocking",
    }),
    jewel: asset.gltf("/assets/kenney/jewel.glb", {
      preload: "blocking",
    }),
    tree: asset.gltf("/assets/kenney/tree-pine.glb", {
      preload: "blocking",
    }),
    crate: asset.gltf("/assets/kenney/crate.glb", {
      preload: "blocking",
    }),
    flag: asset.gltf("/assets/kenney/flag.glb", {
      preload: "blocking",
    }),
    spikes: asset.gltf("/assets/kenney/trap-spikes.glb", {
      preload: "blocking",
    }),
    heart: asset.gltf("/assets/kenney/heart.glb", {
      preload: "blocking",
    }),
    spring: asset.gltf("/assets/kenney/spring.glb", {
      preload: "blocking",
    }),
    sign: asset.gltf("/assets/kenney/sign.glb", {
      preload: "blocking",
    }),
    fence: asset.gltf("/assets/kenney/fence-straight.glb", {
      preload: "blocking",
    }),
  },
  signals: {
    gems: signal.number(0),
    totalGems: signal.number(TOTAL_GEMS),
    runState: signal.string("run"),
    time: signal.number(0),
    playerX: signal.number(0),
    playerY: signal.number(0),
    deaths: signal.number(0),
    message: signal.string("Collect every gem and reach the flag"),
  },
  input: {
    actions: {
      moveLeft: [{ keyboard: "ArrowLeft" }, { keyboard: "KeyA" }],
      moveRight: [{ keyboard: "ArrowRight" }, { keyboard: "KeyD" }],
      jump: [
        { keyboard: "Space" },
        { keyboard: "ArrowUp" },
        { keyboard: "KeyW" },
      ],
      reset: [{ keyboard: "KeyR" }],
    },
  },
  render: {
    clearColor: [0.52, 0.75, 0.94, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
  },
  diagnostics: {
    level: "info",
  },
});
