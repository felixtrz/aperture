import {
  AppEntityKey,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createSystem,
  hexColor,
} from "@aperture-engine/app/systems";
import { Sprite, SpriteBlendMode, createSprite } from "@aperture-engine/render";
import {
  CLOUDS,
  ENEMIES,
  ENEMY_MUZZLE_OFFSETS,
  LEVEL_COLLIDERS,
  LEVEL_INSTANCES,
  PLAYER_BODY_HALF_HEIGHT,
  PLAYER_BODY_KEY,
  PLAYER_BODY_RADIUS,
  PLAYER_BODY_START,
  PLAYER_START,
  WEAPONS,
} from "../lib/fps-data.js";

const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

const HIDDEN_EFFECT_POSITION: [number, number, number] = [0, -100, 0];
const IDENTITY_ROTATION: [number, number, number, number] = [0, 0, 0, 1];
const IDENTITY_SCALE: [number, number, number] = [1, 1, 1];
const HIDDEN_EFFECT_WORLD: {
  readonly col0: [number, number, number, number];
  readonly col1: [number, number, number, number];
  readonly col2: [number, number, number, number];
  readonly col3: [number, number, number, number];
} = {
  col0: [1, 0, 0, 0],
  col1: [0, 1, 0, 0],
  col2: [0, 0, 1, 0],
  col3: [0, -100, 0, 1],
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

    this.spawn.physics({
      key: PLAYER_BODY_KEY,
      name: "Player Physics Body",
      tags: ["player", "physics", "character"],
      transform: {
        translation: PLAYER_BODY_START,
      },
      physics: {
        rigidBody: {
          type: "kinematicPosition",
          canSleep: false,
          lockRotationX: true,
          lockRotationY: true,
          lockRotationZ: true,
        },
        collider: {
          shape: {
            kind: "capsule",
            radius: PLAYER_BODY_RADIUS,
            halfHeight: PLAYER_BODY_HALF_HEIGHT,
          },
          friction: 0.2,
          restitution: 0,
        },
        velocity: true,
        kinematicTarget: {
          enabled: true,
          translation: PLAYER_BODY_START,
        },
        characterController: {
          offset: 0.02,
          slide: true,
          snapToGroundDistance: 0.18,
          maxSlopeClimbAngle: Math.PI / 4,
          minSlopeSlideAngle: Math.PI / 3,
          autostep: {
            maxHeight: 0.35,
            minWidth: 0.2,
          },
        },
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
          ...(cloud.rotation === undefined
            ? { rotationEulerDegrees: [0, cloud.yawDegrees ?? 0, 0] }
            : { rotation: cloud.rotation }),
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

    this.#spawnSpriteEffect({
      key: "effect.muzzle-burst",
      name: "Muzzle Burst",
      textureId: "muzzle-burst",
      size: [0.75, 0.38],
      blendMode: SpriteBlendMode.Additive,
    });

    this.#spawnSpriteEffect({
      key: "effect.impact-hit",
      name: "Impact Hit",
      textureId: "impact-hit",
      size: [0.85, 0.85],
      blendMode: SpriteBlendMode.Alpha,
    });

    for (const index of ENEMY_MUZZLE_OFFSETS.keys()) {
      this.#spawnSpriteEffect({
        key: `effect.enemy-muzzle.${index}`,
        name: `Enemy Muzzle ${index + 1}`,
        textureId: "muzzle-burst",
        size: [0.42, 0.42],
        blendMode: SpriteBlendMode.Additive,
      });
    }
  }

  #spawnSpriteEffect(input: {
    readonly key: string;
    readonly name: string;
    readonly textureId: string;
    readonly size: readonly [number, number];
    readonly blendMode: SpriteBlendMode;
  }): void {
    const entity = this.createEntity();
    entity.addComponent(Enabled, { value: true });
    entity.addComponent(Name, { value: input.name });
    entity.addComponent(AppEntityKey, { value: input.key });
    entity.addComponent(LocalTransform, {
      translation: HIDDEN_EFFECT_POSITION,
      rotation: IDENTITY_ROTATION,
      scale: IDENTITY_SCALE,
    });
    entity.addComponent(Parent, { entity: null });
    entity.addComponent(WorldTransform, HIDDEN_EFFECT_WORLD);
    entity.addComponent(
      Sprite,
      createSprite({
        texture: this.assets.texture(input.textureId).renderHandle,
        size: input.size,
        color: [1, 1, 1, 0],
        blendMode: input.blendMode,
      }),
    );
  }
}
