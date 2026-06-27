import { createSystem, material, mesh } from "@aperture-engine/app/systems";

// Spawns a camera and a single procedural cube — enough to extract a non-empty
// RenderSnapshot with one mesh draw and no external assets.
export default class SceneSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
    });
    this.spawn.light({
      key: "light.key",
      kind: "directional",
      illuminance: 4,
      transform: { rotationEulerDegrees: [-45, 35, 0] },
    });
    this.spawn.light({
      key: "light.fill",
      kind: "ambient",
      intensity: 0.75,
    });
    this.spawn.mesh({
      key: "cube",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [0, 0, 0] },
    });
  }
}
