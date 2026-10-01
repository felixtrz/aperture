import {
  createSystem,
  material,
  mesh,
  type HeightfieldMeshDescriptorOptions,
} from "@aperture-engine/app/systems";

/** Explicit samples: changing a height needs no seed, noise library, or packing. */
export const terrain: HeightfieldMeshDescriptorOptions = {
  label: "Low-poly hillside",
  width: 8,
  depth: 6,
  heights: [
    [0, 0.2, 0.4, 0.1, 0],
    [0.1, 0.8, 1.6, 0.7, 0.1],
    [0, 0.5, 1.1, 0.4, -0.1],
    [-0.1, 0, 0.2, 0, -0.2],
  ],
};

export default class HeightfieldAuthoringScene extends createSystem() {
  override init(): void {
    const group = this.spawn.group({ key: "terrain.assembly" });
    this.spawn.mesh({
      key: "terrain.surface",
      mesh: mesh.heightfield(terrain),
      material: material.standard({
        baseColor: [0.22, 0.38, 0.12, 1],
        roughness: 0.95,
      }),
      transform: { parent: group },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.camera({
      key: "camera",
      camera: { frustumCulling: false },
      transform: { translation: [9, 8, 11], lookAt: [0, 0.5, 0] },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3,
      shadow: true,
      transform: { rotationEulerDegrees: [-55, -30, 0] },
    });
  }
}
