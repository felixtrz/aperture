import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { CAMERA, LEVEL, PLAYER, TOTAL_GEMS } from "../level";

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
        clearColor: [0.55, 0.76, 0.92, 1],
      },
    });

    this.spawn.light({
      key: "light.sun",
      name: "sun",
      kind: "directional",
      illuminance: 7.5,
      transform: {
        rotationEulerDegrees: [-48, 34, 0],
      },
    });

    this.spawn.light({
      key: "light.sky",
      name: "sky-fill",
      kind: "ambient",
      intensity: 0.7,
    });

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
      this.spawn.mesh({
        key: `level.platform.${platform.key}`,
        name: `platform.${platform.key}`,
        tags: ["platform"],
        mesh: mesh.box({
          size: [platform.bounds.width, platform.bounds.height, 0.72],
        }),
        material: material.standard({
          baseColor: [0.2, 0.66, 0.29, 1],
          roughness: 0.9,
          metallic: 0,
        }),
        transform: {
          translation: [platform.bounds.x, platform.bounds.y, 0.04],
        },
      });
    }

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
      this.spawn.mesh({
        key: `level.hazard.${hazard.key}`,
        name: `hazard.${hazard.key}`,
        tags: ["hazard"],
        mesh: mesh.box({
          size: [hazard.bounds.width, hazard.bounds.height, 0.45],
        }),
        material: material.standard({
          baseColor: [0.86, 0.12, 0.12, 1],
          roughness: 0.55,
          metallic: 0,
        }),
        transform: {
          translation: [hazard.bounds.x, hazard.bounds.y, 0.1],
        },
      });
    }

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
      this.spawn.mesh({
        key: `level.gem.${index}`,
        name: `gem.${index}`,
        tags: ["gem"],
        mesh:
          gem.asset === "coin"
            ? mesh.cylinder({ radius: 0.18, depth: 0.08, segments: 32 })
            : mesh.sphere({ radius: 0.2, segments: 24 }),
        material: material.standard({
          baseColor:
            gem.asset === "coin" ? [1, 0.74, 0.16, 1] : [0.15, 0.88, 1, 1],
          roughness: 0.32,
          metallic: gem.asset === "coin" ? 0.4 : 0.05,
        }),
        transform: {
          translation: gem.position,
          scale: gem.scale,
          rotationEulerDegrees: gem.asset === "coin" ? [90, 0, 0] : [0, 0, 0],
        },
      });
    });

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

    this.spawn.gltf(this.assets.gltf("hero"), {
      key: "player.hero.asset",
      name: "player.asset",
      tags: ["playerAsset"],
      transform: {
        translation: [PLAYER.start[0], PLAYER.start[1], -0.05],
        scale: PLAYER.assetScale,
        rotationEulerDegrees: [0, 25, 0],
      },
    });
    this.spawn.mesh({
      key: "player.marker",
      name: "player",
      tags: ["player"],
      mesh: mesh.capsule({ radius: 0.32, depth: 0.9, segments: 24 }),
      material: material.standard({
        baseColor: [0.95, 0.08, 0.48, 1],
        roughness: 0.48,
        metallic: 0,
      }),
      transform: {
        translation: PLAYER.start,
        scale: PLAYER.visualScale,
        rotationEulerDegrees: [0, 25, 0],
      },
    });

    this.signals.totalGems.value = TOTAL_GEMS;
    this.signals.gems.value = 0;
    this.signals.runState.value = "run";
    this.signals.time.value = 0;
    this.signals.playerX.value = PLAYER.start[0];
  }
}
