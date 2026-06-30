import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 3, 7],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 25, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.45,
    });

    this.spawn.mesh({
      key: "level.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [9, 0.3, 1.5] }),
      material: material.standard({
        baseColor: [0.18, 0.44, 0.32, 1],
        roughness: 0.65,
      }),
      transform: { translation: [0, -0.15, 0] },
    });

    this.spawn.mesh({
      key: "player",
      name: "Player",
      tags: ["player", "controllable"],
      mesh: mesh.box({ size: [0.5, 0.8, 0.5] }),
      material: material.standard({
        baseColor: [0.18, 0.58, 1, 1],
        roughness: 0.45,
      }),
      transform: { translation: [-3.5, 0.55, 0] },
    });

    this.spawn.gltf(this.assets.gltf("goal"), {
      key: "collectible.goal",
      name: "Goal Gem",
      tags: ["collectible", "goal"],
      transform: { translation: [1.8, 0.65, 0], scale: [0.35, 0.35, 0.35] },
    });

    this.spawn.mesh({
      key: "finish.flag",
      name: "Finish",
      tags: ["finish"],
      mesh: mesh.box({ size: [0.25, 1.2, 0.25] }),
      material: material.standard({
        baseColor: [1, 0.25, 0.3, 1],
        roughness: 0.5,
      }),
      transform: { translation: [3.8, 0.6, 0] },
    });
  }
}
