import type {
  QuatTuple as Quat,
  Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";

export interface WeaponSpec {
  readonly name: string;
  readonly assetId: string;
  readonly soundId: string;
  readonly crosshairUrl: string;
  readonly cooldown: number;
  readonly maxDistance: number;
  readonly damage: number;
  readonly spread: number;
  readonly shotCount: number;
  readonly knockback: number;
  readonly minKnockback: readonly [number, number];
  readonly maxKnockback: readonly [number, number];
  readonly position: Vec3;
  readonly rotationEulerDegrees: Vec3;
  readonly scale: Vec3;
  readonly muzzlePosition: Vec3;
}

export interface LevelInstance {
  readonly key: string;
  readonly assetId: string;
  readonly position: Vec3;
  readonly rotation?: Quat | undefined;
  readonly yawDegrees?: number | undefined;
  readonly scale?: Vec3 | undefined;
  readonly tags: readonly string[];
}

export interface CloudSpec extends LevelInstance {
  readonly hoverVelocity: number;
  readonly hoverRate: number;
}

export interface LevelCollider {
  readonly key: string;
  readonly position: Vec3;
  readonly halfExtents: Vec3;
  readonly yawDegrees?: number | undefined;
  readonly surface?: boolean;
}

export interface EnemySpec {
  readonly key: string;
  readonly position: Vec3;
  readonly yawDegrees?: number | undefined;
}

export interface PlatformLargeGrassDecorationSpec {
  readonly keySuffix: string;
  readonly assetId: "grass" | "grass-small";
  readonly position: Vec3;
  readonly yawDegrees?: number | undefined;
  readonly tags: readonly string[];
}

export const FPS_INPUT_COMMAND_CHANNEL = "fps.input";

export type FpsInputCommand =
  | {
      readonly kind: "move";
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: "button";
      readonly action: "jump" | "shoot" | "switchWeapon" | "reset";
      readonly pressed: boolean;
    };

export const SOURCE_ENEMY_MUZZLE_OFFSETS: readonly [Vec3, Vec3] = [
  [-0.45, 0.3, 0.4],
  [0.45, 0.3, 0.4],
];
export const ENEMY_MUZZLE_OFFSETS = SOURCE_ENEMY_MUZZLE_OFFSETS;

export function enemyMuzzleEffectKey(
  enemyKey: string,
  muzzleIndex: number,
): string {
  return `effect.${enemyKey}.muzzle.${muzzleIndex}`;
}

export const SOURCE_ENEMY_HITBOX_OFFSET: Vec3 = [0, 0.25, 0];
export const SOURCE_ENEMY_HITBOX_RADIUS = 0.75;
export const SOURCE_ENEMY_RAYCAST_TARGET: Vec3 = [0, 0, 5];
export const SOURCE_ENEMY_ATTACK_DISTANCE = Math.hypot(
  ...SOURCE_ENEMY_RAYCAST_TARGET,
);
export const SOURCE_ENEMY_ATTACK_INTERVAL = 0.25;
export const SOURCE_ENEMY_ATTACK_DAMAGE = 5;
export const SOURCE_ENEMY_HOVER_VELOCITY = 1;
export const SOURCE_ENEMY_HOVER_RATE = 5;
export const SOURCE_ENEMY_HOVER_AMPLITUDE =
  SOURCE_ENEMY_HOVER_VELOCITY / SOURCE_ENEMY_HOVER_RATE;
export const SOURCE_ENEMY_MUZZLE_ROLL_RANGE = Math.PI / 4;
export const ENEMY_HITBOX_OFFSET = SOURCE_ENEMY_HITBOX_OFFSET;
export const SOURCE_PLAYER_ROOT_Y = 0.5;
export const SOURCE_PLAYER_HEAD_Y = 1.0;
export const SOURCE_PLAYER_COLLIDER_CENTER_Y = 0.55;
export const SOURCE_PLAYER_CAPSULE_RADIUS = 0.3;
export const SOURCE_PLAYER_CAPSULE_HEIGHT = 1.0;
export const SOURCE_PLAYER_CAPSULE_HALF_HEIGHT =
  (SOURCE_PLAYER_CAPSULE_HEIGHT - SOURCE_PLAYER_CAPSULE_RADIUS * 2) / 2;
export const SOURCE_PLAYER_CAMERA_FOV = 80;
export const SOURCE_PLAYER_CAMERA_CULL_MASK = 1_048_573;
export const SOURCE_WEAPON_CAMERA_CULL_MASK = 1_047_554;
export const FPS_WORLD_LAYER_MASK = 1;
export const FPS_WEAPON_LAYER_MASK = 2;
export const FPS_ALL_RENDER_LAYER_MASK =
  FPS_WORLD_LAYER_MASK | FPS_WEAPON_LAYER_MASK;
export const PLAYER_EYE_HEIGHT = SOURCE_PLAYER_ROOT_Y + SOURCE_PLAYER_HEAD_Y;
export const PLAYER_BODY_KEY = "player.body";
export const PLAYER_SHADOW_KEY = "player.shadow";
export const PLAYER_BODY_RADIUS = SOURCE_PLAYER_CAPSULE_RADIUS;
export const PLAYER_BODY_HALF_HEIGHT = SOURCE_PLAYER_CAPSULE_HALF_HEIGHT;
export const PLAYER_BODY_COLLIDER_OFFSET: Vec3 = [
  0,
  SOURCE_PLAYER_COLLIDER_CENTER_Y,
  0,
];
export const PLAYER_BODY_EYE_OFFSET = SOURCE_PLAYER_HEAD_Y;
export const PLAYER_SHADOW_SURFACE_OFFSET = 0.02;
export const PLAYER_START: Vec3 = [0, PLAYER_EYE_HEIGHT, 0];
export const PLAYER_BODY_START: Vec3 = [0, SOURCE_PLAYER_ROOT_Y, 0];
export const PLAYER_SPEED = 5;
export const SOURCE_MOVEMENT_LERP_RATE = 10;
export const JUMP_STRENGTH = 8;
export const GRAVITY = 20;
export const MAX_JUMPS = 2;
export const SOURCE_RESET_BODY_HOLD_FRAMES = 3;
export const SOURCE_MOUSE_SENSITIVITY = 700;
export const SOURCE_GAMEPAD_LOOK_SENSITIVITY = 0.075;
export const SOURCE_LOOK_LERP_RATE = 25;
export const SOURCE_LOOK_PITCH_LIMIT = Math.PI / 2;
export const SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT = 26;
export const SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT =
  SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT / SOURCE_MOUSE_SENSITIVITY;
export const SOURCE_WEAPON_CONTAINER_INITIAL_POSITION: Vec3 = [1.2, -1, -2.25];
export const SOURCE_WEAPON_CONTAINER_OFFSET: Vec3 = [1.2, -1.1, -2.75];
export const SOURCE_WEAPON_MODEL_POSITION: Vec3 = [0, 0, 0];
export const SOURCE_WEAPON_MODEL_SCALE: Vec3 = [1, 1, 1];
export const SOURCE_WEAPON_VIEW_POSITION: Vec3 = [
  SOURCE_WEAPON_CONTAINER_OFFSET[0] + SOURCE_WEAPON_MODEL_POSITION[0],
  SOURCE_WEAPON_CONTAINER_OFFSET[1] + SOURCE_WEAPON_MODEL_POSITION[1],
  SOURCE_WEAPON_CONTAINER_OFFSET[2] + SOURCE_WEAPON_MODEL_POSITION[2],
];
// Aperture mirrors the Godot transparent SubViewport with a weapon-only camera
// rigged to the player camera alongside its viewmodel. Keep the extracted source
// transform above intact; this runtime position is calibrated for Aperture's
// WebGPU projection and the app canvas aspect.
export const FPS_WEAPON_VIEW_POSITION: Vec3 = [2.05, -1.05, -2.75];
export const SOURCE_WEAPON_MUZZLE_POSITION: Vec3 = [0.1, -0.4, 1.5];
export const SOURCE_WEAPON_CAMERA_ITEM_FOV = 40;
export const WEAPON_CAMERA_KEY = "camera.weapon";
export const SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE = 1 / 30;
export const SOURCE_WEAPON_SHOT_KICK = 0.25;
export const SOURCE_WEAPON_SWITCH_DROP_OFFSET = 1;
export const SOURCE_WEAPON_SWITCH_HIDE_DURATION = 0.1;
export const SOURCE_WEAPON_SWITCH_RAISE_RATE = 10;
export const SOURCE_CLOUD_RANDOM_MIN = 0.1;
export const SOURCE_CLOUD_RANDOM_MAX = 2.0;
export const SOURCE_ENV_BACKGROUND_COLOR: readonly [
  number,
  number,
  number,
  number,
] = [0x5c / 0xff, 0x64 / 0xff, 0x76 / 0xff, 1];
export const SOURCE_ENV_AMBIENT_COLOR: readonly [
  number,
  number,
  number,
  number,
] = [0xa9 / 0xff, 0xb1 / 0xff, 0xc5 / 0xff, 1];
export const SOURCE_ENV_AMBIENT_INTENSITY = 1;
export const SOURCE_SKY_ENERGY_MULTIPLIER = 0.5;
// From scenes/main.tscn Sun Transform3D basis, converted from Godot basis
// columns to an Aperture quaternion.
export const SOURCE_SUN_ROTATION: Quat = [
  0.22707267, -0.76437232, -0.35643233, 0.48695873,
];
export const SOURCE_SUN_SHADOW_STRENGTH = 0.75;
// Aperture packs directional-light travel from the authored -Z basis, matching
// Godot's DirectionalLight3D orientation convention for this source transform.
export const FPS_RENDER_SUN_ROTATION: Quat = [
  SOURCE_SUN_ROTATION[0],
  SOURCE_SUN_ROTATION[1],
  SOURCE_SUN_ROTATION[2],
  SOURCE_SUN_ROTATION[3],
];
export const FPS_RENDER_BACKGROUND_COLOR: readonly [
  number,
  number,
  number,
  number,
] = [0.36, 0.39, 0.46, 1];
export const FPS_RENDER_AMBIENT_COLOR: readonly [
  number,
  number,
  number,
  number,
] = [0.66, 0.69, 0.77, 1];
export const FPS_RENDER_AMBIENT_INTENSITY = 1.1;

export const WEAPONS: readonly WeaponSpec[] = [
  {
    name: "Blaster",
    assetId: "blaster",
    soundId: "blaster-shot",
    crosshairUrl: "/sprites/crosshair.png",
    cooldown: 0.25,
    maxDistance: 10,
    damage: 25,
    spread: 1,
    shotCount: 3,
    knockback: 40,
    minKnockback: [0.025, 0.025],
    maxKnockback: [0.045, 0.04],
    position: [...FPS_WEAPON_VIEW_POSITION],
    rotationEulerDegrees: [0, 180, 0],
    scale: [...SOURCE_WEAPON_MODEL_SCALE],
    muzzlePosition: [...SOURCE_WEAPON_MUZZLE_POSITION],
  },
  {
    name: "Repeater",
    assetId: "blaster-repeater",
    soundId: "blaster-repeater-shot",
    crosshairUrl: "/sprites/crosshair-repeater.png",
    cooldown: 0.1,
    maxDistance: 10,
    damage: 10,
    spread: 0.5,
    shotCount: 1,
    knockback: 10,
    minKnockback: [0.001, 0.001],
    maxKnockback: [0.0025, 0.002],
    position: [...FPS_WEAPON_VIEW_POSITION],
    rotationEulerDegrees: [0, 180, 0],
    scale: [...SOURCE_WEAPON_MODEL_SCALE],
    muzzlePosition: [...SOURCE_WEAPON_MUZZLE_POSITION],
  },
];

export const IMPACT_EFFECT_SLOT_COUNT = Math.max(
  ...WEAPONS.map((weapon) => weapon.shotCount),
);

export function impactEffectKey(slotIndex: number): string {
  return `effect.impact-hit.${slotIndex}`;
}

export function platformLargeGrassDecorationKey(
  platformKey: string,
  decoration: PlatformLargeGrassDecorationSpec,
): string {
  return `${platformKey}.${decoration.keySuffix}`;
}

export const ENEMIES: readonly EnemySpec[] = [
  { key: "enemy.0", position: [-3.5, 2.5, -6], yawDegrees: 0 },
  { key: "enemy.1", position: [-9.5, 2.5, 1.5], yawDegrees: 90 },
  { key: "enemy.2", position: [5.5, 3.5, 9], yawDegrees: -135 },
  { key: "enemy.3", position: [15.5, 4, -7.5], yawDegrees: 45 },
];

export const LEVEL_INSTANCES: readonly LevelInstance[] = [
  {
    key: "level.wall-low.0",
    assetId: "wall-low",
    position: [-1.92088, 1.05, -6.90166],
    yawDegrees: -15,
    tags: ["level", "wall"],
  },
  {
    key: "level.wall-low.1",
    assetId: "wall-low",
    position: [6.07912, 1.05, 6.59834],
    yawDegrees: 180,
    tags: ["level", "wall"],
  },
  {
    key: "level.platform.0",
    assetId: "platform",
    position: [-2.5, 0, 6.5],
    tags: ["level", "platform"],
  },
  {
    key: "level.platform.1",
    assetId: "platform",
    position: [-6.5, 2.5, -2.5],
    tags: ["level", "platform"],
  },
  {
    key: "level.platform.2",
    assetId: "platform",
    position: [2.5, 3, -3.5],
    tags: ["level", "platform"],
  },
  {
    key: "level.platform.3",
    assetId: "platform",
    position: [7, 1, -2],
    yawDegrees: 45,
    tags: ["level", "platform"],
  },
  {
    key: "level.wall-high.0",
    assetId: "wall-high",
    position: [-5.5, 1.5, 4],
    tags: ["level", "wall"],
  },
  {
    key: "level.wall-high.1",
    assetId: "wall-high",
    position: [11.5, 3, -5.5],
    yawDegrees: 45,
    tags: ["level", "wall"],
  },
  {
    key: "level.platform-large-grass.0",
    assetId: "platform-large-grass",
    position: [0, -0.5, 0],
    tags: ["level", "ground"],
  },
  {
    key: "level.platform-large-grass.1",
    assetId: "platform-large-grass",
    position: [-2, 0.5, -6],
    yawDegrees: -15,
    tags: ["level", "ground"],
  },
  {
    key: "level.platform-large-grass.2",
    assetId: "platform-large-grass",
    position: [-6, 1, 2.5],
    yawDegrees: 15,
    tags: ["level", "ground"],
  },
  {
    key: "level.platform-large-grass.3",
    assetId: "platform-large-grass",
    position: [12, 2.5, -5],
    yawDegrees: 30,
    tags: ["level", "ground"],
  },
  {
    key: "level.platform-large-grass.4",
    assetId: "platform-large-grass",
    position: [5, 0.5, 5.5],
    yawDegrees: -15,
    tags: ["level", "ground"],
  },
];

export const PLATFORM_LARGE_GRASS_DECORATIONS: readonly PlatformLargeGrassDecorationSpec[] =
  [
    {
      keySuffix: "grass.0",
      assetId: "grass",
      position: [-1.57788, 0.5, 1.72158],
      tags: ["decoration", "grass"],
    },
    {
      keySuffix: "grass-small.0",
      assetId: "grass-small",
      position: [1.88646, 0.5, -1.59607],
      tags: ["decoration", "grass"],
    },
    {
      keySuffix: "grass.1",
      assetId: "grass",
      position: [1.46331, 0.5, -1.52249],
      yawDegrees: -38.5,
      tags: ["decoration", "grass"],
    },
  ];

export const CLOUDS: readonly CloudSpec[] = [
  {
    key: "deco.cloud.0",
    assetId: "cloud",
    position: [-9.48509, 8.49799, 20.5554],
    rotation: [-0.23999, -0.54459, -0.12815, 0.79335],
    scale: [4, 4, 4],
    hoverVelocity: 0.55,
    hoverRate: 1.1,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.1",
    assetId: "cloud",
    position: [25.5597, 6.35221, -12.1167],
    rotation: [0.23999, 0.54459, 0.12815, 0.79335],
    scale: [4, 4, 4],
    hoverVelocity: 0.95,
    hoverRate: 1.45,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.2",
    assetId: "cloud",
    position: [6.4111, 6.35221, -28.6551],
    rotation: [0.20916, 0.33042, 0.07863, 0.917],
    scale: [4, 4, 4],
    hoverVelocity: 0.7,
    hoverRate: 0.85,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.3",
    assetId: "cloud",
    position: [-2.75413, 2.42683, 25.3984],
    rotation: [0, -0.38268, 0, 0.92388],
    scale: [3, 3, 3],
    hoverVelocity: 0.35,
    hoverRate: 1.75,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.4",
    assetId: "cloud",
    position: [27.5131, 12.0265, -5.37209],
    rotation: [-0.39668, 0.30438, -0.5272, 0.68706],
    scale: [3, 3, 3],
    hoverVelocity: 1.25,
    hoverRate: 1.6,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.5",
    assetId: "cloud",
    position: [-28.6125, 16.2998, -4.89238],
    rotation: [0.15756, 0.20533, 0.58802, 0.76632],
    scale: [3, 3, 3],
    hoverVelocity: 0.8,
    hoverRate: 0.95,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.6",
    assetId: "cloud",
    position: [-25.14, 8.80719, -24.2564],
    rotation: [0.15756, 0.20533, 0.58802, 0.76632],
    scale: [3, 3, 3],
    hoverVelocity: 1.45,
    hoverRate: 1.25,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.7",
    assetId: "cloud",
    position: [14.1295, 10.1139, 17.5347],
    rotation: [0.03378, -0.12608, 0.95766, 0.25661],
    scale: [2, 2, 2],
    hoverVelocity: 0.45,
    hoverRate: 1.9,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.8",
    assetId: "cloud",
    position: [-5.11081, 2.42683, -36.641],
    rotation: [0.35355, 0.35355, -0.14645, 0.85355],
    scale: [2, 2, 2],
    hoverVelocity: 1.05,
    hoverRate: 1.35,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.9",
    assetId: "cloud",
    position: [-30.1261, 2.42683, -13.7339],
    rotation: [0, -0.25882, 0, 0.96593],
    scale: [2, 2, 2],
    hoverVelocity: 0.62,
    hoverRate: 0.72,
    tags: ["decoration", "cloud"],
  },
  {
    key: "deco.cloud.10",
    assetId: "cloud",
    position: [-0.8815, 13.0297, -30.1859],
    rotation: [0.43715, 0.5592, -0.01716, 0.70421],
    scale: [3, 3, 3],
    hoverVelocity: 1.65,
    hoverRate: 1.8,
    tags: ["decoration", "cloud"],
  },
];

export const LEVEL_COLLIDERS: readonly LevelCollider[] = [
  ...LEVEL_INSTANCES.filter((instance) =>
    instance.assetId.startsWith("platform-large-grass"),
  ).map((instance) =>
    levelCollider(instance, {
      position: [
        instance.position[0],
        instance.position[1] + 0.25,
        instance.position[2],
      ],
      halfExtents: [2.5, 0.25, 2.5],
      surface: true,
    }),
  ),
  ...LEVEL_INSTANCES.filter((instance) => instance.assetId === "platform").map(
    (instance) =>
      levelCollider(instance, {
        position: [
          instance.position[0],
          instance.position[1] + 0.25,
          instance.position[2],
        ],
        halfExtents: [1, 0.25, 1],
        surface: true,
      }),
  ),
  ...LEVEL_INSTANCES.filter((instance) => instance.assetId === "wall-low").map(
    (instance) =>
      levelCollider(instance, {
        position: instance.position,
        halfExtents: [1.1, 0.45, 0.35],
        surface: false,
      }),
  ),
  ...LEVEL_INSTANCES.filter((instance) => instance.assetId === "wall-high").map(
    (instance) =>
      levelCollider(instance, {
        position: instance.position,
        halfExtents: [0.75, 0.85, 0.35],
        surface: false,
      }),
  ),
];

function levelCollider(
  instance: LevelInstance,
  collider: Omit<LevelCollider, "key" | "yawDegrees">,
): LevelCollider {
  const base: LevelCollider = {
    key: `${instance.key}.collider`,
    ...collider,
  };
  if (instance.yawDegrees === undefined) return base;
  return { ...base, yawDegrees: instance.yawDegrees };
}
