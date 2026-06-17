import {
  AppEntityKey,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createSystem,
  hexColor,
  mesh,
  type Entity,
} from "@aperture-engine/app/systems";
import {
  RenderLayer,
  Sprite,
  SpriteBlendMode,
  SpriteDepthMode,
  createDefaultRenderState,
  createEquirectangularCubeTextureAsset,
  createSamplerAsset,
  createSprite,
  createUnlitMaterialAsset,
  materialAssetDependencies,
  type TextureAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  getChildren,
  createSamplerHandle,
  createTextureHandle,
  type EcsWorld,
  type MaterialHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  CLOUDS,
  ENEMIES,
  ENEMY_MUZZLE_OFFSETS,
  FPS_ALL_RENDER_LAYER_MASK,
  FPS_WEAPON_LAYER_MASK,
  FPS_WORLD_LAYER_MASK,
  IMPACT_EFFECT_SLOT_COUNT,
  LEVEL_COLLIDERS,
  LEVEL_INSTANCES,
  PLATFORM_LARGE_GRASS_DECORATIONS,
  PLAYER_BODY_HALF_HEIGHT,
  PLAYER_BODY_COLLIDER_OFFSET,
  PLAYER_BODY_KEY,
  PLAYER_BODY_RADIUS,
  PLAYER_BODY_START,
  PLAYER_EYE_HEIGHT,
  PLAYER_SHADOW_KEY,
  PLAYER_SHADOW_SURFACE_OFFSET,
  PLAYER_START,
  FPS_RENDER_AMBIENT_COLOR,
  FPS_RENDER_AMBIENT_INTENSITY,
  FPS_RENDER_BACKGROUND_COLOR,
  FPS_RENDER_SUN_ROTATION_EULER_DEGREES,
  SOURCE_ENEMY_HITBOX_OFFSET,
  SOURCE_ENEMY_HITBOX_RADIUS,
  SOURCE_PLAYER_CAMERA_FOV,
  SOURCE_SKY_ENERGY_MULTIPLIER,
  SOURCE_SUN_SHADOW_STRENGTH,
  SOURCE_WEAPON_CAMERA_ITEM_FOV,
  WEAPONS,
  WEAPON_CAMERA_KEY,
  enemyMuzzleEffectKey,
  impactEffectKey,
  platformLargeGrassDecorationKey,
} from "../lib/fps-data.js";
import {
  SOURCE_ENEMY_MUZZLE_SPRITE_SIZE,
  SOURCE_IMPACT_SPRITE_SIZE,
  SOURCE_PLAYER_MUZZLE_SPRITE_SIZE,
} from "../lib/fps-effects.js";

const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

const PLAYER_SHADOW_MATERIAL_ID = "player.blob-shadow.material";
const PLAYER_SHADOW_SAMPLER_ID = "player.blob-shadow.sampler";
const SKYBOX_TEXTURE_ID = "fps.skybox.cube";
const SKYBOX_SAMPLER_ID = "fps.skybox.sampler";
const SKYBOX_SOURCE_ASSET_ID = "skybox";
const SKYBOX_FACE_SIZE = 512;
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
      fovYDegrees: SOURCE_PLAYER_CAMERA_FOV,
      camera: {
        near: 0.05,
        far: 80,
        layerMask: FPS_WORLD_LAYER_MASK,
        clearColor: FPS_RENDER_BACKGROUND_COLOR,
      },
    });

    this.spawn.camera({
      key: WEAPON_CAMERA_KEY,
      name: "Weapon Camera",
      tags: ["player", "camera", "weapon-camera"],
      transform: {
        parent: camera,
      },
      fovYDegrees: SOURCE_WEAPON_CAMERA_ITEM_FOV,
      camera: {
        near: 0.05,
        far: 20,
        priority: 1,
        layerMask: FPS_WEAPON_LAYER_MASK,
        clearColor: [0, 0, 0, 0],
        frustumCulling: false,
      },
    });

    this.#spawnSourceSkybox();

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
          offsetTranslation: PLAYER_BODY_COLLIDER_OFFSET,
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

    this.#spawnPlayerShadow();

    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      color: hexColor(0xffffff),
      illuminance: 3.6,
      light: {
        layerMask: FPS_ALL_RENDER_LAYER_MASK,
      },
      transform: {
        rotationEulerDegrees: FPS_RENDER_SUN_ROTATION_EULER_DEGREES,
      },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        strength: SOURCE_SUN_SHADOW_STRENGTH,
        filterRadius: 2,
        normalBias: 0.04,
      },
    });

    this.spawn.light({
      key: "light.ambient",
      name: "Sky Ambient",
      kind: "ambient",
      color: FPS_RENDER_AMBIENT_COLOR,
      intensity: FPS_RENDER_AMBIENT_INTENSITY,
      light: {
        layerMask: FPS_ALL_RENDER_LAYER_MASK,
      },
    });

    this.spawn.fog({
      key: "fog.main",
      name: "Sky Fog",
      mode: "linear",
      color: FPS_RENDER_BACKGROUND_COLOR,
      start: 28,
      end: 60,
    });

    for (const instance of LEVEL_INSTANCES) {
      const root = this.spawn.gltf(this.assets.gltf(instance.assetId), {
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

      if (instance.assetId === "platform-large-grass") {
        this.#spawnPlatformLargeGrassDecorations(root, instance.key);
      }
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
        transform: {
          translation: addVec3(enemy.position, SOURCE_ENEMY_HITBOX_OFFSET),
        },
        physics: {
          rigidBody: { type: "static" },
          collider: {
            shape: { kind: "sphere", radius: SOURCE_ENEMY_HITBOX_RADIUS },
            friction: 0,
            restitution: 0,
          },
        },
      });
    }

    for (const [index, weapon] of WEAPONS.entries()) {
      const weaponRoot = this.spawn.gltf(this.assets.gltf(weapon.assetId), {
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
          scale: weapon.scale,
        },
      });
      this.#assignRenderLayerToSubtree(weaponRoot, FPS_WEAPON_LAYER_MASK);
    }

    this.#spawnSpriteEffect({
      key: "effect.muzzle-burst",
      name: "Muzzle Burst",
      textureId: "muzzle-burst",
      size: SOURCE_PLAYER_MUZZLE_SPRITE_SIZE,
      blendMode: SpriteBlendMode.Additive,
      depthMode: SpriteDepthMode.Disabled,
      layerMask: FPS_WEAPON_LAYER_MASK,
    });

    for (let index = 0; index < IMPACT_EFFECT_SLOT_COUNT; index += 1) {
      this.#spawnSpriteEffect({
        key: impactEffectKey(index),
        name: `Impact Hit ${index + 1}`,
        textureId: "impact-hit",
        size: SOURCE_IMPACT_SPRITE_SIZE,
        blendMode: SpriteBlendMode.Alpha,
        depthMode: SpriteDepthMode.Disabled,
      });
    }

    for (const enemy of ENEMIES) {
      for (const index of ENEMY_MUZZLE_OFFSETS.keys()) {
        this.#spawnSpriteEffect({
          key: enemyMuzzleEffectKey(enemy.key, index),
          name: `${enemy.key} Muzzle ${index + 1}`,
          textureId: "muzzle-burst",
          size: SOURCE_ENEMY_MUZZLE_SPRITE_SIZE,
          blendMode: SpriteBlendMode.Additive,
        });
      }
    }
  }

  #spawnSpriteEffect(input: {
    readonly key: string;
    readonly name: string;
    readonly textureId: string;
    readonly size: readonly [number, number];
    readonly blendMode: SpriteBlendMode;
    readonly depthMode?: SpriteDepthMode;
    readonly layerMask?: number;
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
    if (input.layerMask !== undefined) {
      entity.addComponent(RenderLayer, { mask: input.layerMask });
    }
    entity.addComponent(
      Sprite,
      createSprite({
        texture: this.assets.texture(input.textureId).renderHandle,
        size: input.size,
        color: [1, 1, 1, 0],
        blendMode: input.blendMode,
        ...(input.depthMode === undefined
          ? {}
          : { depthMode: input.depthMode }),
      }),
    );
  }

  #assignRenderLayerToSubtree(root: Entity, mask: number): void {
    const world = this.world as EcsWorld;
    const childrenByParent = this.#childrenByParent();
    const visited = new Set<string>();
    const stack = [root];

    while (stack.length > 0) {
      const entity = stack.pop()!;
      const key = this.#entityKey(entity);
      if (!entity.active || visited.has(key)) {
        continue;
      }

      visited.add(key);
      this.#setRenderLayer(entity, mask);

      for (const child of this.#subtreeChildren(
        world,
        entity,
        childrenByParent,
      )) {
        stack.push(child);
      }
    }
  }

  #setRenderLayer(entity: Entity, mask: number): void {
    if (entity.hasComponent(RenderLayer)) {
      entity.setValue(RenderLayer, "mask", mask);
      return;
    }

    entity.addComponent(RenderLayer, { mask });
  }

  #childrenByParent(): ReadonlyMap<string, readonly Entity[]> {
    const world = this.world as EcsWorld;
    const byParent = new Map<string, Entity[]>();
    const query = world.queryManager.registerQuery({ required: [Parent] });

    for (const entity of query.entities) {
      if (!entity.active) {
        continue;
      }

      const parent = entity.getValue(Parent, "entity");
      if (parent === null || parent === undefined || !parent.active) {
        continue;
      }

      const key = this.#entityKey(parent);
      const children = byParent.get(key) ?? [];
      children.push(entity);
      byParent.set(key, children);
    }

    return byParent;
  }

  #subtreeChildren(
    world: EcsWorld,
    entity: Entity,
    childrenByParent: ReadonlyMap<string, readonly Entity[]>,
  ): readonly Entity[] {
    const indexed = getChildren(world, entity);
    const parentLinked = childrenByParent.get(this.#entityKey(entity)) ?? [];

    if (indexed.length === 0) {
      return parentLinked;
    }
    if (parentLinked.length === 0) {
      return indexed;
    }

    const merged = [...indexed];
    const seen = new Set(indexed.map((child) => this.#entityKey(child)));
    for (const child of parentLinked) {
      if (!seen.has(this.#entityKey(child))) {
        merged.push(child);
      }
    }
    return merged;
  }

  #entityKey(entity: Entity): string {
    return `${entity.index}:${entity.generation}`;
  }

  #spawnPlatformLargeGrassDecorations(
    parent: Entity,
    platformKey: string,
  ): void {
    for (const decoration of PLATFORM_LARGE_GRASS_DECORATIONS) {
      this.spawn.gltf(this.assets.gltf(decoration.assetId), {
        key: platformLargeGrassDecorationKey(platformKey, decoration),
        name: platformLargeGrassDecorationKey(platformKey, decoration),
        tags: decoration.tags,
        materials: GLTF_FRONT_SIDE_MATERIALS,
        castShadow: true,
        receiveShadow: true,
        transform: {
          parent,
          translation: decoration.position,
          ...(decoration.yawDegrees === undefined
            ? {}
            : {
                rotationEulerDegrees: [0, decoration.yawDegrees, 0] as [
                  number,
                  number,
                  number,
                ],
              }),
        },
      });
    }
  }

  #spawnSourceSkybox(): void {
    const texture = this.#ensureSkyboxTexture();
    if (texture === null) return;

    this.spawn.skybox({
      key: "skybox.main",
      name: "Source Panorama Skybox",
      texture,
      sampler: this.#ensureSkyboxSampler(),
      intensity: SOURCE_SKY_ENERGY_MULTIPLIER,
    });
  }

  #ensureSkyboxTexture(): TextureHandle | null {
    const sourceHandle = this.assets.texture(
      SKYBOX_SOURCE_ASSET_ID,
    ).renderHandle;
    const sourceEntry = this.assetsRegistry.get<"texture", TextureAsset>(
      sourceHandle,
    );

    if (sourceEntry?.status !== "ready" || sourceEntry.asset === null) {
      return null;
    }

    const textureHandle = createTextureHandle(SKYBOX_TEXTURE_ID);
    if (!this.assetsRegistry.has(textureHandle)) {
      this.assetsRegistry.register(textureHandle, {
        label: "Source Panorama Skybox",
      });
    }
    this.assetsRegistry.markReady(
      textureHandle,
      createEquirectangularCubeTextureAsset(sourceEntry.asset, {
        label: "Source Panorama Skybox",
        faceSize: SKYBOX_FACE_SIZE,
      }),
    );
    return textureHandle;
  }

  #ensureSkyboxSampler(): SamplerHandle {
    const samplerHandle = createSamplerHandle(SKYBOX_SAMPLER_ID);
    if (!this.assetsRegistry.has(samplerHandle)) {
      this.assetsRegistry.register(samplerHandle, {
        label: "Source Panorama Skybox Sampler",
      });
    }

    this.assetsRegistry.markReady(
      samplerHandle,
      createSamplerAsset({
        label: "Source Panorama Skybox Sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        lodMaxClamp: 0,
      }),
    );
    return samplerHandle;
  }

  #spawnPlayerShadow(): void {
    this.spawn.mesh({
      key: PLAYER_SHADOW_KEY,
      name: "Player Blob Shadow",
      tags: ["player", "shadow"],
      mesh: mesh.plane({ size: [1, 1] }),
      material: this.#ensurePlayerShadowMaterial(),
      castShadow: false,
      receiveShadow: false,
      transform: {
        translation: [
          PLAYER_START[0],
          PLAYER_START[1] - PLAYER_EYE_HEIGHT + PLAYER_SHADOW_SURFACE_OFFSET,
          PLAYER_START[2],
        ],
        rotationEulerDegrees: [-90, 0, 0],
      },
    });
  }

  #ensurePlayerShadowMaterial(): MaterialHandle {
    const texture = this.assets.texture("blob-shadow").renderHandle;
    const sampler = this.#ensurePlayerShadowSampler();
    const materialHandle = createMaterialHandle(PLAYER_SHADOW_MATERIAL_ID);
    const material = createUnlitMaterialAsset({
      label: "Player Blob Shadow",
      baseColorFactor: new Float32Array([1, 1, 1, 0.705882]),
      baseColorTexture: { texture, sampler },
      renderState: createDefaultRenderState({
        alphaMode: "blend",
        cullMode: "none",
        depth: {
          test: true,
          write: false,
          compare: "less-equal",
        },
        blend: { preset: "alpha" },
      }),
    });

    if (!this.assetsRegistry.has(materialHandle)) {
      this.assetsRegistry.register(materialHandle, {
        label: "Player Blob Shadow",
        dependencies: materialAssetDependencies(material),
      });
    }

    this.assetsRegistry.markReady(materialHandle, material);
    return materialHandle;
  }

  #ensurePlayerShadowSampler(): SamplerHandle {
    const samplerHandle = createSamplerHandle(PLAYER_SHADOW_SAMPLER_ID);
    if (!this.assetsRegistry.has(samplerHandle)) {
      this.assetsRegistry.register(samplerHandle, {
        label: "Player Blob Shadow Sampler",
      });
    }

    this.assetsRegistry.markReady(
      samplerHandle,
      createSamplerAsset({
        label: "Player Blob Shadow Sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      }),
    );
    return samplerHandle;
  }
}

function addVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
