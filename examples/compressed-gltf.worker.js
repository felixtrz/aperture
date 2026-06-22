import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  assets: {
    draco: asset.gltf("/examples/assets/draco-heart.glb", {
      preload: "blocking",
    }),
    ktx2: asset.gltf("/examples/assets/basis-ktx2-texture.glb", {
      preload: "blocking",
    }),
  },
  assetDecoders: {
    baseUrl: "/examples/assets/",
  },
  render: {
    defaultCamera: false,
    defaultLight: false,
  },
});

class CompressedGltfSetupSystem extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.camera({
      key: "camera.main",
      name: "compressed-gltf-camera",
      transform: {
        translation: [0, 0.2, 4.5],
        lookAt: [0, 0.15, 0],
      },
      fovYDegrees: 45,
      near: 0.1,
      far: 100,
    });
    this.spawn.light({
      key: "light.key",
      name: "compressed-gltf-key-light",
      kind: "directional",
      illuminance: 5,
      transform: {
        rotationEulerDegrees: [-35, 30, 0],
      },
    });
    this.spawn.light({
      key: "light.ambient",
      name: "compressed-gltf-ambient",
      kind: "ambient",
      intensity: 0.45,
    });
    this.spawn.gltf(this.assets.gltf("draco"), {
      key: "asset.draco-heart",
      name: "Draco heart",
      transform: {
        translation: [-1.15, 0, 0],
        scale: [1.25, 1.25, 1.25],
      },
    });
    this.spawn.gltf(this.assets.gltf("ktx2"), {
      key: "asset.basis-ktx2",
      name: "Basis KTX2 texture",
      transform: {
        translation: [1.15, 0, 0],
        scale: [1.4, 1.4, 1.4],
      },
    });
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: CompressedGltfSetupSystem }],
});
