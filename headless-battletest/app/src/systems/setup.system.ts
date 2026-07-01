import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { Basket } from "../components.ts";

// Priority < 0 so the scene exists before gameplay systems run their first
// update. Spawns the camera, lights, floor, and the player-controlled basket.
export default class SetupSystem extends createSystem({ priority: -100 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: { translation: [0, 2.5, 12], lookAt: [0, 2.5, 0] },
      fovYDegrees: 45,
      // Per-camera clearColor DOES work (unlike config render.clearColor — see
      // FINDINGS F1). A dark night-sky blue proves the background is honored.
      // Note it lives under `camera:`, not at the top level of spawn.camera().
      camera: { clearColor: [0.02, 0.03, 0.07, 1] },
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 5,
      transform: { rotationEulerDegrees: [-50, 25, 0] },
    });
    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.4,
    });

    // Floor strip near the bottom of the play area.
    this.spawn.mesh({
      key: "floor",
      name: "Floor",
      tags: ["level"],
      mesh: mesh.box({ size: [16, 0.4, 2] }),
      material: material.standard({
        baseColor: [0.12, 0.16, 0.22, 1],
        roughness: 0.85,
      }),
      transform: { translation: [0, -1.2, 0] },
    });

    // The catcher.
    const basket = this.spawn.mesh({
      key: "basket",
      name: "Basket",
      tags: ["basket", "controllable"],
      mesh: mesh.box({ size: [1.8, 0.5, 1.4] }),
      material: material.standard({
        baseColor: [0.2, 0.75, 1, 1],
        roughness: 0.35,
      }),
      transform: { translation: [0, 0.6, 0] },
    });
    // addComponent auto-registers Basket on the world (elics semantics).
    basket.addComponent(Basket, { speed: 7, halfWidth: 1.1 });
  }
}
