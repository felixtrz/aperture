import {
  LocalTransform,
  Name,
  Parent,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import { CAMERA, LEVEL, PLAYER, TOTAL_GEMS } from "../level.js";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [
          PLAYER.start[0],
          PLAYER.start[1] + CAMERA.yOffset,
          CAMERA.distance,
        ],
        lookAt: [PLAYER.start[0], PLAYER.start[1] + CAMERA.targetYOffset, 0],
      },
      fovYDegrees: 48,
      camera: {
        clearColor: [0.52, 0.75, 0.94, 1],
      },
    });

    this.spawn.light({
      key: "light.sun",
      name: "sun",
      kind: "directional",
      color: [1, 0.96, 0.88, 1],
      illuminance: 7.8,
      transform: {
        rotationEulerDegrees: [-48, 34, 0],
      },
    });

    this.spawn.light({
      key: "light.sky",
      name: "sky-fill",
      kind: "ambient",
      color: [0.72, 0.84, 1, 1],
      intensity: 0.78,
    });

    this.#spawnBackdrop();
    this.#spawnPlatforms();
    this.#spawnHazards();
    this.#spawnGems();
    this.#spawnProps();
    this.#spawnPlayer();

    this.#setSignal("totalGems", TOTAL_GEMS);
    this.#setSignal("gems", 0);
    this.#setSignal("runState", "run");
    this.#setSignal("time", 0);
    this.#setSignal("playerX", PLAYER.start[0]);
    this.#setSignal("playerY", PLAYER.start[1]);
    this.#setSignal("deaths", 0);
    this.#setSignal("message", "Collect every gem and reach the flag");
  }

  #spawnBackdrop(): void {
    this.spawn.mesh({
      key: "backdrop.ground-shadow",
      name: "ground-shadow",
      tags: ["backdrop"],
      mesh: mesh.box({ size: [18, 0.08, 0.18] }),
      material: material.standard({
        baseColor: [0.18, 0.48, 0.24, 1],
        roughness: 0.92,
        metallic: 0,
      }),
      transform: {
        translation: [0.8, -0.44, -0.38],
      },
    });

    for (const cloud of LEVEL.clouds) {
      this.spawn.mesh({
        key: `backdrop.${cloud.key}`,
        name: cloud.key,
        tags: ["backdrop", "cloud"],
        mesh: mesh.sphere({ radius: 0.55, segments: 24 }),
        material: material.standard({
          baseColor: [0.96, 0.98, 1, 1],
          roughness: 0.8,
          metallic: 0,
        }),
        transform: {
          translation: cloud.position,
          scale: cloud.scale,
        },
      });
    }
  }

  #spawnPlatforms(): void {
    for (const platform of LEVEL.platforms) {
      this.spawn.gltf(this.assets.gltf(platform.asset), {
        key: `level.platform.asset.${platform.key}`,
        name: `platform.asset.${platform.key}`,
        tags: ["platformAsset"],
        transform: {
          translation: platform.position,
          scale: platform.scale,
        },
      });
    }
  }

  #spawnHazards(): void {
    for (const hazard of LEVEL.hazards) {
      this.spawn.gltf(this.assets.gltf(hazard.asset), {
        key: `level.hazard.asset.${hazard.key}`,
        name: `hazard.asset.${hazard.key}`,
        tags: ["hazardAsset"],
        transform: {
          translation: hazard.position,
          scale: hazard.scale,
        },
      });
    }
  }

  #spawnGems(): void {
    LEVEL.gems.forEach((gem, index) => {
      this.spawn.gltf(this.assets.gltf(gem.asset), {
        key: `level.gem.asset.${index}`,
        name: `gem.asset.${index}`,
        tags: ["gemAsset"],
        transform: {
          translation: gem.position,
          scale: gem.scale,
        },
      });
    });
  }

  #spawnProps(): void {
    for (const prop of LEVEL.props) {
      this.spawn.gltf(this.assets.gltf(prop.asset), {
        key: `level.prop.${prop.key}`,
        name: `prop.${prop.key}`,
        tags: ["prop"],
        transform: {
          translation: prop.position,
          scale: prop.scale,
          ...(prop.rotationEulerDegrees === undefined
            ? {}
            : { rotationEulerDegrees: prop.rotationEulerDegrees }),
        },
      });
    }
  }

  #spawnPlayer(): void {
    const player = this.createEntity();
    player.addComponent(Name, { value: "player" });
    player.addComponent(LocalTransform, {
      translation: [...PLAYER.start],
      scale: [...PLAYER.visualScale],
    });
    player.addComponent(Parent, { entity: null });

    this.spawn.gltf(this.assets.gltf("hero"), {
      key: "player.hero.asset",
      name: "player.asset",
      tags: ["playerAsset"],
      transform: {
        translation: [PLAYER.start[0], PLAYER.start[1], -0.05],
        scale: PLAYER.assetScale,
        rotationEulerDegrees: [0, 20, 0],
      },
    });
  }

  #setSignal(name: string, value: number | string): void {
    const signal = this.signals[name];

    if (signal !== undefined) {
      signal.value = value;
    }
  }
}
