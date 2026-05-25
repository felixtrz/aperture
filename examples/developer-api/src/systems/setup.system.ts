import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export const schedule = { priority: 0 };

export default class SetupSystem extends createSystem() {
  override init(): void {
    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [1, 0.55, 0.25, 1],
        roughness: 0.55,
        metallic: 0.05,
      }),
      transform: { translation: [-1, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      transform: { translation: [1, 0, 0] },
    });
  }
}
