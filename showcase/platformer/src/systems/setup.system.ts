import {
  createSystem,
  hexColor,
  mesh,
  quatFromEulerYXZ,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import {
  createDefaultRenderState,
  createEquirectangularCubeTextureAsset,
  createSamplerAsset,
  createUnlitMaterialAsset,
  materialAssetDependencies,
  type TextureAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
  type MaterialHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  AMBIENT_COLOR,
  AMBIENT_INTENSITY,
  BRICKS,
  BRICK_COLLIDER_OFFSET,
  BRICK_HALF_EXTENT,
  CAMERA_FOV,
  CAMERA_INITIAL_PITCH_DEG,
  CAMERA_INITIAL_YAW_DEG,
  CAMERA_INITIAL_ZOOM,
  CAMERA_KEY,
  CAMERA_TARGET_Y_OFFSET,
  CLOUDS,
  COINS,
  FALLING_PLATFORMS,
  FLAG,
  PLAYER_BODY_KEY,
  PLAYER_BODY_START,
  PLAYER_CAPSULE_HALF_HEIGHT,
  PLAYER_CAPSULE_RADIUS,
  PLAYER_COLLIDER_OFFSET,
  PLAYER_MODEL_KEY,
  PLAYER_SHADOW_KEY,
  SKY_COLOR,
  SKY_ENERGY,
  STATIC_PLATFORMS,
  SUN_ILLUMINANCE,
  SUN_ROTATION,
  colliderMeshId,
} from "../lib/platformer-data.js";
import { cameraOffset, degToRad } from "../lib/platformer-controls.js";

const FRONT_SIDE = { renderState: { cullMode: "back" as const } };
const SHADOW_MATERIAL_ID = "player.blob-shadow.material";
const SHADOW_SAMPLER_ID = "player.blob-shadow.sampler";
const SKYBOX_TEXTURE_ID = "platformer.skybox.cube";
const SKYBOX_SAMPLER_ID = "platformer.skybox.sampler";
const SKYBOX_FACE_SIZE = 512;

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.#spawnCamera();
    this.#spawnLighting();
    this.#spawnSkybox();
    this.#spawnPlayer();
    this.#spawnLevel();
    this.#spawnObjects();
  }

  #spawnCamera(): void {
    const yaw = degToRad(CAMERA_INITIAL_YAW_DEG);
    const pitch = degToRad(CAMERA_INITIAL_PITCH_DEG);
    const target: Vec3 = [
      PLAYER_BODY_START[0],
      PLAYER_BODY_START[1] + CAMERA_TARGET_Y_OFFSET,
      PLAYER_BODY_START[2],
    ];
    const offset = cameraOffset(yaw, pitch, CAMERA_INITIAL_ZOOM);
    this.spawn.camera({
      key: CAMERA_KEY,
      name: "Main Camera",
      tags: ["camera"],
      transform: {
        translation: [
          target[0] + offset[0],
          target[1] + offset[1],
          target[2] + offset[2],
        ],
        rotation: quatFromEulerYXZ(pitch, yaw, 0),
      },
      fovYDegrees: CAMERA_FOV,
      camera: {
        near: 0.1,
        far: 200,
        clearColor: SKY_COLOR,
      },
    });
  }

  #spawnLighting(): void {
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      color: hexColor(0xffffff),
      illuminance: SUN_ILLUMINANCE,
      transform: { rotation: SUN_ROTATION },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.75,
        filterRadius: 2,
        normalBias: 0.04,
      },
    });

    this.spawn.light({
      key: "light.ambient",
      name: "Ambient",
      kind: "ambient",
      color: AMBIENT_COLOR,
      intensity: AMBIENT_INTENSITY,
    });
  }

  #spawnPlayer(): void {
    this.spawn.physics({
      key: PLAYER_BODY_KEY,
      name: "Player Body",
      tags: ["player", "character"],
      transform: { translation: PLAYER_BODY_START },
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
            radius: PLAYER_CAPSULE_RADIUS,
            halfHeight: PLAYER_CAPSULE_HALF_HEIGHT,
          },
          offsetTranslation: PLAYER_COLLIDER_OFFSET,
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
          autostep: { maxHeight: 0.35, minWidth: 0.2 },
        },
      },
    });

    this.spawn.gltf(this.assets.gltf("character"), {
      key: PLAYER_MODEL_KEY,
      name: "Player Model",
      tags: ["player", "model"],
      materials: FRONT_SIDE,
      castShadow: true,
      receiveShadow: true,
      transform: { translation: PLAYER_BODY_START },
    });

    this.spawn.mesh({
      key: PLAYER_SHADOW_KEY,
      name: "Player Shadow",
      tags: ["player", "shadow"],
      mesh: mesh.plane({ size: [1.1, 1.1] }),
      material: this.#shadowMaterial(),
      castShadow: false,
      receiveShadow: false,
      transform: {
        translation: [
          PLAYER_BODY_START[0],
          PLAYER_BODY_START[1] + 0.02,
          PLAYER_BODY_START[2],
        ],
        rotationEulerDegrees: [-90, 0, 0],
      },
    });
  }

  #spawnLevel(): void {
    for (const platform of STATIC_PLATFORMS) {
      this.spawn.gltf(this.assets.gltf(platform.assetId), {
        key: `${platform.key}.model`,
        name: platform.key,
        tags: ["level", "platform"],
        materials: FRONT_SIDE,
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: platform.position,
          rotationEulerDegrees: [0, platform.yawDegrees, 0],
        },
      });
      this.spawn.physics({
        key: platform.key,
        name: `${platform.key}.collider`,
        tags: ["level", "collider"],
        transform: {
          translation: platform.position,
          rotationEulerDegrees: [0, platform.yawDegrees, 0],
        },
        physics: {
          rigidBody: { type: "static" },
          collider: {
            shape: {
              kind: "trimesh",
              meshId: colliderMeshId(platform.assetId),
            },
            friction: 1,
            restitution: 0,
          },
        },
      });
    }

    for (const platform of FALLING_PLATFORMS) {
      this.spawn.gltf(this.assets.gltf("platform-falling"), {
        key: `${platform.key}.model`,
        name: platform.key,
        tags: ["level", "falling-platform"],
        materials: FRONT_SIDE,
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: platform.position,
          rotationEulerDegrees: [0, platform.yawDegrees, 0],
        },
      });
      // Static trimesh collider (the only reliably solid kind for the character
      // controller). "Falling" is handled by hazards.system disabling this
      // collider after a short grace while the visual model animates downward.
      this.spawn.physics({
        key: platform.key,
        name: `${platform.key}.collider`,
        tags: ["level", "falling-platform", "collider"],
        transform: {
          translation: platform.position,
          rotationEulerDegrees: [0, platform.yawDegrees, 0],
        },
        physics: {
          rigidBody: { type: "static" },
          collider: {
            shape: {
              kind: "trimesh",
              meshId: colliderMeshId("platform-falling"),
            },
            friction: 1,
            restitution: 0,
          },
        },
      });
    }

    for (const brick of BRICKS) {
      this.spawn.gltf(this.assets.gltf("brick"), {
        key: `${brick.key}.model`,
        name: brick.key,
        tags: ["level", "brick"],
        materials: FRONT_SIDE,
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: brick.position,
          rotationEulerDegrees: [0, brick.yawDegrees, 0],
        },
      });
      this.spawn.physics({
        key: brick.key,
        name: `${brick.key}.collider`,
        tags: ["level", "brick", "collider"],
        transform: {
          translation: brick.position,
          rotationEulerDegrees: [0, brick.yawDegrees, 0],
        },
        physics: {
          rigidBody: { type: "static" },
          collider: {
            shape: {
              kind: "box",
              halfExtents: [
                BRICK_HALF_EXTENT,
                BRICK_HALF_EXTENT,
                BRICK_HALF_EXTENT,
              ],
            },
            offsetTranslation: BRICK_COLLIDER_OFFSET,
            friction: 1,
            restitution: 0,
          },
        },
      });
    }
  }

  #spawnObjects(): void {
    for (const coin of COINS) {
      this.spawn.gltf(this.assets.gltf("coin"), {
        key: coin.key,
        name: coin.key,
        tags: ["coin"],
        materials: FRONT_SIDE,
        castShadow: true,
        receiveShadow: false,
        transform: { translation: coin.position },
      });
    }

    for (const cloud of CLOUDS) {
      this.spawn.gltf(this.assets.gltf("cloud"), {
        key: cloud.key,
        name: cloud.key,
        tags: ["decoration", "cloud"],
        materials: FRONT_SIDE,
        castShadow: false,
        receiveShadow: false,
        transform: {
          translation: cloud.position,
          rotationEulerDegrees: [0, cloud.yawDegrees, 0],
          scale: [cloud.scale, cloud.scale, cloud.scale],
        },
      });
    }

    this.spawn.gltf(this.assets.gltf("flag"), {
      key: FLAG.key,
      name: "Flag",
      tags: ["goal", "flag"],
      materials: FRONT_SIDE,
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: FLAG.position,
        rotationEulerDegrees: [0, FLAG.yawDegrees, 0],
      },
    });
  }

  // --- skybox + shadow assets (mirrors the fps reference) ---------------------

  #spawnSkybox(): void {
    const texture = this.#skyboxTexture();
    if (texture === null) return;
    this.spawn.skybox({
      key: "skybox.main",
      name: "Skybox",
      texture,
      sampler: this.#skyboxSampler(),
      intensity: SKY_ENERGY,
    });
  }

  #skyboxTexture(): TextureHandle | null {
    const sourceHandle = this.assets.texture("skybox").renderHandle;
    const sourceEntry = this.assetsRegistry.get<"texture", TextureAsset>(
      sourceHandle,
    );
    if (sourceEntry?.status !== "ready" || sourceEntry.asset === null) {
      return null;
    }
    const handle = createTextureHandle(SKYBOX_TEXTURE_ID);
    if (!this.assetsRegistry.has(handle)) {
      this.assetsRegistry.register(handle, { label: "Skybox" });
    }
    this.assetsRegistry.markReady(
      handle,
      createEquirectangularCubeTextureAsset(sourceEntry.asset, {
        label: "Skybox",
        faceSize: SKYBOX_FACE_SIZE,
      }),
    );
    return handle;
  }

  #skyboxSampler(): SamplerHandle {
    const handle = createSamplerHandle(SKYBOX_SAMPLER_ID);
    if (!this.assetsRegistry.has(handle)) {
      this.assetsRegistry.register(handle, { label: "Skybox Sampler" });
    }
    this.assetsRegistry.markReady(
      handle,
      createSamplerAsset({
        label: "Skybox Sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        lodMaxClamp: 0,
      }),
    );
    return handle;
  }

  #shadowMaterial(): MaterialHandle {
    const texture = this.assets.texture("blob-shadow").renderHandle;
    const sampler = this.#shadowSampler();
    const handle = createMaterialHandle(SHADOW_MATERIAL_ID);
    const material = createUnlitMaterialAsset({
      label: "Player Blob Shadow",
      baseColorFactor: new Float32Array([0, 0, 0, 0.55]),
      baseColorTexture: { texture, sampler },
      renderState: createDefaultRenderState({
        alphaMode: "blend",
        cullMode: "none",
        depth: { test: true, write: false, compare: "less-equal" },
        blend: { preset: "alpha" },
      }),
    });
    if (!this.assetsRegistry.has(handle)) {
      this.assetsRegistry.register(handle, {
        label: "Player Blob Shadow",
        dependencies: materialAssetDependencies(material),
      });
    }
    this.assetsRegistry.markReady(handle, material);
    return handle;
  }

  #shadowSampler(): SamplerHandle {
    const handle = createSamplerHandle(SHADOW_SAMPLER_ID);
    if (!this.assetsRegistry.has(handle)) {
      this.assetsRegistry.register(handle, {
        label: "Player Blob Shadow Sampler",
      });
    }
    this.assetsRegistry.markReady(
      handle,
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
    return handle;
  }
}
