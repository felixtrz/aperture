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
export const contentShowcaseMeshId = "content-showcase-route-mesh";
export const contentShowcaseMaterialId = "content-showcase-route-material";

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
  const mesh = registerContentShowcaseMesh(aperture, registry);

  return {
    sprites,
    text,
    ui,
    particles,
    mesh,
    expected: {
      meshDraws: 1,
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

function registerContentShowcaseMesh(aperture, registry) {
  const mesh = aperture.createMeshHandle(contentShowcaseMeshId);
  const material = aperture.createMaterialHandle(contentShowcaseMaterialId);

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createBoxMeshAsset({
      label: "ContentShowcaseQueuedRouteMesh",
      width: 0.45,
      height: 0.45,
      depth: 0.08,
    }),
  );
  registry.register(material);
  registry.markReady(
    material,
    aperture.createUnlitMaterialAsset({
      label: "ContentShowcaseQueuedRouteMaterial",
      baseColorFactor: new Float32Array([0.24, 0.88, 0.72, 1]),
    }),
  );

  return {
    mesh,
    material,
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
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
