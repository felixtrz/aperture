import { createSystem, hexColor } from "@aperture-engine/app/systems";
import {
  CLOUDS,
  ENEMIES,
  LEVEL_COLLIDERS,
  LEVEL_INSTANCES,
  PLAYER_START,
  WEAPONS,
} from "../lib/fps-data.js";

const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const camera = this.spawn.camera({
      key: "camera.main",
      name: "Player Camera",
      tags: ["player", "camera"],
      transform: {
        translation: PLAYER_START,
        rotationEulerDegrees: [0, 0, 0],
      },
      fovYDegrees: 80,
      camera: {
        near: 0.05,
        far: 80,
        clearColor: [0.36, 0.39, 0.46, 1],
      },
    });

    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      color: hexColor(0xffffff),
      illuminance: 3.6,
      transform: {
        rotationEulerDegrees: [-50, -110, 0],
      },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        filterRadius: 2,
        normalBias: 0.04,
      },
    });

    this.spawn.light({
      key: "light.ambient",
      name: "Sky Ambient",
      kind: "ambient",
      color: [0.66, 0.69, 0.77, 1],
      intensity: 1.1,
    });

    this.spawn.fog({
      key: "fog.main",
      name: "Sky Fog",
      mode: "linear",
      color: [0.36, 0.39, 0.46, 1],
      start: 28,
      end: 60,
    });

    for (const instance of LEVEL_INSTANCES) {
      this.spawn.gltf(this.assets.gltf(instance.assetId), {
        key: instance.key,
        name: instance.key,
        tags: instance.tags,
        materials: GLTF_FRONT_SIDE_MATERIALS,
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: instance.position,
          rotationEulerDegrees: [0, instance.yawDegrees ?? 0, 0],
          scale: instance.scale ?? [1, 1, 1],
        },
      });
    }

    for (const cloud of CLOUDS) {
      this.spawn.gltf(this.assets.gltf(cloud.assetId), {
        key: cloud.key,
        name: cloud.key,
        tags: cloud.tags,
        materials: GLTF_FRONT_SIDE_MATERIALS,
        castShadow: false,
        receiveShadow: false,
        transform: {
          translation: cloud.position,
          rotationEulerDegrees: [0, cloud.yawDegrees ?? 0, 0],
          scale: cloud.scale ?? [1, 1, 1],
        },
      });
    }

    for (const collider of LEVEL_COLLIDERS) {
      this.spawn.physics({
        key: collider.key,
        name: collider.key,
        tags: ["level", "collider"],
        transform: {
          translation: collider.position,
          rotationEulerDegrees: [0, collider.yawDegrees ?? 0, 0],
        },
        physics: {
          rigidBody: { type: "static" },
          collider: {
            shape: { kind: "box", halfExtents: collider.halfExtents },
            friction: 1,
            restitution: 0,
          },
        },
      });
    }

    for (const enemy of ENEMIES) {
      this.spawn.gltf(this.assets.gltf("enemy-flying"), {
        key: enemy.key,
        name: enemy.key,
        tags: ["enemy"],
        materials: GLTF_FRONT_SIDE_MATERIALS,
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: enemy.position,
          rotationEulerDegrees: [0, enemy.yawDegrees ?? 0, 0],
        },
      });

      this.spawn.physics({
        key: `${enemy.key}.hitbox`,
        name: `${enemy.key}.hitbox`,
        tags: ["enemy", "hitbox"],
        transform: { translation: enemy.position },
        physics: {
          rigidBody: { type: "static" },
          collider: {
            shape: { kind: "sphere", radius: 0.75 },
            friction: 0,
            restitution: 0,
          },
        },
      });
    }

    for (const [index, weapon] of WEAPONS.entries()) {
      this.spawn.gltf(this.assets.gltf(weapon.assetId), {
        key: `weapon.${index}`,
        name: weapon.name,
        tags: ["weapon", index === 0 ? "active-weapon" : "inactive-weapon"],
        materials: GLTF_FRONT_SIDE_MATERIALS,
        castShadow: false,
        receiveShadow: false,
        transform: {
          parent: camera,
          translation:
            index === 0 ? weapon.position : [weapon.position[0], -100, 0],
          rotationEulerDegrees: weapon.rotationEulerDegrees,
          scale: [0.65, 0.65, 0.65],
        },
      });
    }
  }
}
