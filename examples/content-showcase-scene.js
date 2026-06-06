import {
  createMsdfTextSnapshot,
  registerMsdfTextScene,
} from "./msdf-text-scene.js";
import {
  gpuParticlesCapacity,
  registerGpuParticlesScene,
} from "./gpu-particles-scene.js";
import {
  registerSpriteBillboardScene,
  spriteProofs,
} from "./sprite-billboard-scene.js";
import { registerUiHudScene } from "./ui-hud-scene.js";

export const contentShowcaseClearColor = [0.012, 0.016, 0.028, 1];
export const contentShowcasePointer = [0.75, 0.25];

export const contentShowcaseReadbackSamples = [
  { id: "sprite-atlas", x: 0.31, y: 0.27 },
  { id: "msdf-text", x: 0.1698, y: 0.3426 },
  { id: "particle-center", x: 0.5, y: 0.5 },
  { id: "ui-panel", x: 0.84, y: 0.18 },
  { id: "ui-text", x: 0.755, y: 0.28 },
  { id: "background", x: 0.9, y: 0.86 },
];

export function registerContentShowcaseScene(aperture, registry) {
  const sprites = registerSpriteBillboardScene(aperture, registry);
  const text = registerMsdfTextScene(aperture, registry);
  const ui = registerUiHudScene(aperture, registry);
  const particles = registerGpuParticlesScene(aperture, registry);

  return {
    sprites,
    text,
    ui,
    particles,
    expected: {
      meshDraws: 0,
      spriteDraws: 2,
      uiNodes: 4,
      uiHitRegions: 1,
      textGlyphs: 6,
      textBatches: 2,
      particleEmitters: 1,
      liveParticles: gpuParticlesCapacity,
    },
    readbackSamples: contentShowcaseReadbackSamples,
  };
}

export function contentShowcaseSpriteProofs() {
  return spriteProofs.filter(
    (proof) => proof.id === "uv-blue" || proof.id === "rotation-pivot",
  );
}

export function addContentShowcaseText(aperture, scene, baseSnapshot) {
  return createMsdfTextSnapshot(aperture, scene.text, baseSnapshot, "dark");
}
