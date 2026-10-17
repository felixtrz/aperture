import shader from "../material.shader.json" with { type: "json" };
import type { ShaderArtifact } from "@aperture-engine/shader";
import type {
  StandardMaterialAsset,
  MaterialExtensionParameters,
} from "@aperture-engine/render";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createTextureHandle,
  createSamplerHandle,
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createTextureAsset,
  createSamplerAsset,
  createStandardMaterialAsset,
  createSphereMeshAsset,
} from "@aperture-engine/render";

/** A compact parity scene: daylight IBL, sun occlusion, HDR bloom and 4x MSAA. */
export default class SceneSystem extends createSystem({ priority: 0 }) {
  readonly #materialHandle = createMaterialHandle("study.surface");
  #material: StandardMaterialAsset = createStandardMaterialAsset({
    metallicFactor: 0.05,
    roughnessFactor: 0.36,
    renderState: { alphaMode: "mask", alphaCutoff: 0.5, cullMode: "none" },
    extension: {
      shader: shader as ShaderArtifact,
      surface: "paintSurface",
      deform: "deformSurface",
      opacity: "cutoutSurface",
      parameters: [0, 0.2, 0.1, 0.1],
    },
  });
  #phase = 0;
  #amplitude = 0.2;
  #cutout = 0.1;
  #paused = false;
  override init(): void {
    this.assetsRegistry.register(this.#materialHandle);
    this.assetsRegistry.markReady(this.#materialHandle, this.#material);
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
    const deformedMesh = createMeshHandle("study.deformed-sphere");
    const sphere = createSphereMeshAsset({
      radius: 0.8,
      widthSegments: 32,
      heightSegments: 16,
    });
    this.assetsRegistry.register(deformedMesh);
    this.assetsRegistry.markReady(deformedMesh, {
      ...sphere,
      localAabb: { min: [-0.8, -1.25, -0.8], max: [0.8, 1.25, 0.8] },
      localSphere: { center: [0, 0, 0], radius: 1.25 },
    });
    this.spawn.mesh({
      key: "painted-cube",
      mesh: deformedMesh,
      material: this.#materialHandle,
      transform: {
        translation: [-0.9, 1, 0],
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
  override update(delta: number): void {
    for (const command of this.commands.drain<{
      amplitude?: number;
      cutout?: number;
      paused?: boolean;
    }>("material.study")) {
      if (typeof command.amplitude === "number")
        this.#amplitude = Math.max(0, Math.min(0.45, command.amplitude));
      if (typeof command.cutout === "number")
        this.#cutout = Math.max(0, Math.min(0.4, command.cutout));
      if (typeof command.paused === "boolean") this.#paused = command.paused;
    }
    if (!this.#paused) this.#phase += delta * 0.7;
    const parameters: MaterialExtensionParameters = [
      this.#phase,
      this.#amplitude,
      0.1,
      this.#cutout,
    ];
    const extension = this.#material.extension!;
    this.#material = {
      ...this.#material,
      extension: {
        ...extension,
        parameters,
        previousParameters: extension.parameters,
      },
    };
    this.assetsRegistry.markReady(this.#materialHandle, this.#material);
  }
}
