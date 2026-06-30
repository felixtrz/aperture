import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { COINS, GOAL_X, PLATFORMS, PLAYER_SPAWN } from "./level.ts";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "cam",
      transform: { translation: [0, 2, 16], lookAt: [0, 1, 0] },
      fovYDegrees: 55,
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      illuminance: 4,
      transform: { rotationEulerDegrees: [-45, 30, 0] },
    });

    PLATFORMS.forEach((p, i) => {
      const w = p.x1 - p.x0;
      this.spawn.mesh({
        key: `platform.${i}`,
        tags: ["platform"],
        mesh: mesh.box({ size: [w, 0.4, 2] }),
        material: material.standard({ baseColor: [0.25, 0.4, 0.3, 1] }),
        transform: { translation: [(p.x0 + p.x1) / 2, p.top - 0.2, 0] },
      });
    });

    for (const coin of COINS) {
      this.spawn.mesh({
        key: coin.key,
        tags: ["coin"],
        mesh: mesh.box({ size: [0.3, 0.3, 0.3] }),
        material: material.standard({ baseColor: [1, 0.85, 0.2, 1], metallic: 0.8 }),
        transform: { translation: [coin.x, coin.y, 0] },
      });
    }

    this.spawn.mesh({
      key: "player",
      tags: ["player"],
      mesh: mesh.box({ size: [0.5, 0.9, 0.5] }),
      material: material.standard({ baseColor: [0.2, 0.6, 1, 1] }),
      transform: { translation: [PLAYER_SPAWN[0], PLAYER_SPAWN[1], 0] },
    });

    this.spawn.mesh({
      key: "goal",
      tags: ["goal"],
      mesh: mesh.box({ size: [0.3, 1.4, 0.3] }),
      material: material.standard({ baseColor: [1, 0.3, 0.35, 1] }),
      transform: { translation: [GOAL_X, 0.7, 0] },
    });
  }
}
