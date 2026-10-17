import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createTextureHandle,
  createSamplerHandle,
  createMaterialHandle,
} from "@aperture-engine/simulation";
import {
  createTextureAsset,
  createSamplerAsset,
  createStandardMaterialAsset,
} from "@aperture-engine/render";

/** A compact parity scene: daylight IBL, sun occlusion, HDR bloom and 4x MSAA. */
export default class SceneSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const texture = createTextureHandle("parity.checker");
    const sampler = createSamplerHandle("parity.checker-sampler");
    const textured = createMaterialHandle("parity.textured-ground");
    this.assetsRegistry.register(texture);
    this.assetsRegistry.markReady(
      texture,
      createTextureAsset({
        label: "Checker",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        sourceData: {
          bytes: new Uint8Array([
            230, 230, 230, 255, 100, 110, 120, 255, 100, 110, 120, 255, 230,
            230, 230, 255,
          ]),
          bytesPerRow: 8,
        },
      }),
    );
    this.assetsRegistry.register(sampler);
    this.assetsRegistry.markReady(
      sampler,
      createSamplerAsset({ magFilter: "nearest", minFilter: "nearest" }),
    );
    this.assetsRegistry.register(textured);
    this.assetsRegistry.markReady(
      textured,
      createStandardMaterialAsset({
        metallicFactor: 0,
        roughnessFactor: 0.9,
        baseColorTexture: { texture, sampler, transform: { scale: [6, 6] } },
      }),
    );
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [4, 3, 6], lookAt: [0, 0.7, 0] },
      fovYDegrees: 45,
    });
    this.spawn.light({
      key: "light.sun",
      kind: "directional",
      intensity: 4,
      transform: { rotationEulerDegrees: [-45, 35, 0] },
      shadow: {
        mapSize: 256,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.8,
        filterRadius: 2,
        normalBias: 0.02,
      },
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.box({ size: [7, 0.15, 7] }),
      material: textured,
      transform: { translation: [0, -0.075, 0] },
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "painted-cube",
      mesh: mesh.box({ size: [1.4, 1.4, 1.4] }),
      material: material.standard({
        baseColor: [0.1, 0.35, 0.7, 1],
        roughness: 0.35,
      }),
      transform: {
        translation: [-0.8, 0.7, 0],
        rotationEulerDegrees: [0, 20, 0],
      },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "metal-sphere",
      mesh: mesh.sphere({ radius: 0.6 }),
      material: material.standard({
        baseColor: [0.9, 0.65, 0.2, 1],
        roughness: 0.2,
        metallic: 1,
      }),
      transform: { translation: [0.9, 0.6, 0] },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "emissive-marker",
      mesh: mesh.box({ size: [0.15, 0.8, 0.15] }),
      material: material.standard({
        baseColor: [0.1, 0.7, 0.5, 1],
        emissiveFactor: [0.3, 3, 1],
      }),
      transform: { translation: [1.8, 0.4, -0.5] },
      castShadow: true,
    });
  }
}
