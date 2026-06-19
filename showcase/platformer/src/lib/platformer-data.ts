import type {
  QuatTuple as Quat,
  Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export const PLAYER_BODY_KEY = "player.body";
export const PLAYER_MODEL_KEY = "player.model";
export const PLAYER_SHADOW_KEY = "player.shadow";

// Source capsule: radius 0.3, height 1.0, collider centered at y=0.55 above the
// root (objects/player.tscn). Rapier capsule halfHeight excludes the two caps.
export const PLAYER_CAPSULE_RADIUS = 0.3;
export const PLAYER_CAPSULE_HEIGHT = 1.0;
export const PLAYER_CAPSULE_HALF_HEIGHT =
  (PLAYER_CAPSULE_HEIGHT - PLAYER_CAPSULE_RADIUS * 2) / 2;
export const PLAYER_COLLIDER_OFFSET: Vec3 = [0, 0.55, 0];
export const PLAYER_BODY_START: Vec3 = [0, 0.6, 0];

// Tuning. Godot used `movement_speed * delta` (250/60 ≈ 4.17 m/s); gravity was a
// scalar accumulator `+= 25·dt` with `jump_strength = 7`.
export const PLAYER_SPEED = 4.5;
export const GRAVITY = 25;
export const JUMP_STRENGTH = 7;
export const MAX_JUMPS = 2;
export const MOVEMENT_LERP_RATE = 10;
export const ROTATION_LERP_RATE = 10;
export const SCALE_LERP_RATE = 10;
export const RESPAWN_Y = -10;

export const JUMP_SQUASH: Vec3 = [0.5, 1.5, 0.5];
export const LAND_SQUASH: Vec3 = [1.25, 0.75, 1.25];
export const LAND_GRAVITY_THRESHOLD = 2; // source: gravity > 2 on touchdown
export const FOOTSTEP_SPEED_THRESHOLD = 0.3 * PLAYER_SPEED;

// ---------------------------------------------------------------------------
// Camera (orbit rig, from scripts/view.gd + the main.tscn View transform)
// ---------------------------------------------------------------------------

export const CAMERA_KEY = "camera.main";
export const CAMERA_FOV = 40;
export const CAMERA_INITIAL_YAW_DEG = -45;
export const CAMERA_INITIAL_PITCH_DEG = -25;
export const CAMERA_INITIAL_ZOOM = 10;
export const CAMERA_ZOOM_MIN = 4;
export const CAMERA_ZOOM_MAX = 16;
export const CAMERA_ZOOM_SPEED = 10;
export const CAMERA_ROTATE_SPEED_DEG = 120;
export const CAMERA_PITCH_MIN_DEG = -80;
export const CAMERA_PITCH_MAX_DEG = -10;
export const CAMERA_FOLLOW_RATE = 4;
export const CAMERA_ROTATE_LERP = 6;
export const CAMERA_ZOOM_LERP = 8;
export const CAMERA_TARGET_Y_OFFSET = 0.5;

// ---------------------------------------------------------------------------
// Rendering / environment
// ---------------------------------------------------------------------------

export const SKY_COLOR: readonly [number, number, number, number] = [
  0x5c / 0xff,
  0x64 / 0xff,
  0x76 / 0xff,
  1,
];
export const AMBIENT_COLOR: readonly [number, number, number, number] = [
  0xa9 / 0xff,
  0xb1 / 0xff,
  0xc5 / 0xff,
  1,
];
export const AMBIENT_INTENSITY = 1;
export const SUN_ILLUMINANCE = 3.6;
export const SKY_ENERGY = 0.5;
// scenes/main.tscn Sun DirectionalLight3D basis, as an Aperture quaternion.
export const SUN_ROTATION: Quat = [
  0.22707267, -0.76437232, -0.35643233, 0.48695873,
];

// ---------------------------------------------------------------------------
// Level data (extracted from scenes/main.tscn)
// ---------------------------------------------------------------------------

export interface StaticPlatform {
  readonly key: string;
  readonly assetId:
    | "platform"
    | "platform-medium"
    | "platform-grass-large-round";
  readonly position: Vec3;
  readonly yawDegrees: number;
}

export interface FallingPlatform {
  readonly key: string;
  readonly position: Vec3;
  readonly yawDegrees: number;
}

export interface BrickSpec {
  readonly key: string;
  readonly position: Vec3;
  readonly yawDegrees: number;
}

export interface CoinSpec {
  readonly key: string;
  readonly position: Vec3;
}

export interface CloudSpec {
  readonly key: string;
  readonly position: Vec3;
  readonly yawDegrees: number;
  readonly scale: number;
  readonly hoverVelocity: number;
  readonly hoverRate: number;
}

export interface FlagSpec {
  readonly key: string;
  readonly position: Vec3;
  readonly yawDegrees: number;
}

export function colliderMeshId(assetId: string): string {
  return `mesh:${assetId}:mesh:0:primitive:0`;
}

export const STATIC_PLATFORMS: readonly StaticPlatform[] = [
  { key: "platform.0", assetId: "platform", position: [0, 0, 0], yawDegrees: 6.7 },
  { key: "platform.1", assetId: "platform", position: [-15, 0, 4], yawDegrees: 6.7 },
  { key: "platform.2", assetId: "platform", position: [-21.925, 0.347, -2.684], yawDegrees: 6.7 },
  { key: "platform.3", assetId: "platform", position: [-22.076, 1.513, -4.765], yawDegrees: -12.1 },
  { key: "platform.4", assetId: "platform", position: [-3, 2, -3], yawDegrees: 0 },
  { key: "platform.5", assetId: "platform", position: [-3, 3, -5], yawDegrees: 14.9 },
  { key: "platform-medium.0", assetId: "platform-medium", position: [-3, 0, 0], yawDegrees: -5 },
  { key: "platform-medium.1", assetId: "platform-medium", position: [-5, 0, 4], yawDegrees: -5.7 },
  { key: "platform-medium.2", assetId: "platform-medium", position: [-14.942, 0.992, 0.128], yawDegrees: 21.6 },
  { key: "platform-medium.3", assetId: "platform-medium", position: [0, 3, -6], yawDegrees: 0 },
  { key: "platform-grass.0", assetId: "platform-grass-large-round", position: [-7, 1, -2], yawDegrees: 0 },
  { key: "platform-grass.1", assetId: "platform-grass-large-round", position: [-19.31, 1, 2.832], yawDegrees: 0 },
];

export const FALLING_PLATFORMS: readonly FallingPlatform[] = [
  { key: "falling.0", position: [-9, 0.419, 4], yawDegrees: -10 },
  { key: "falling.1", position: [-12, -0.315, 4], yawDegrees: 6 },
  { key: "falling.2", position: [-11.753, 1.83, -2.306], yawDegrees: -20 },
];

export const BRICKS: readonly BrickSpec[] = [
  { key: "brick.0", position: [-3.119, 1.986, -0.089], yawDegrees: 0 },
  { key: "brick.1", position: [-6.764, 3.215, -2.02], yawDegrees: 31.2 },
  { key: "brick.2", position: [-19.034, 3.215, 2.869], yawDegrees: -20.1 },
];

export const COINS: readonly CoinSpec[] = [
  { key: "coin.0", position: [-3, 0.635, 0] },
  { key: "coin.1", position: [-5, 0.635, 4] },
  { key: "coin.2", position: [-7.044, 1.97, -0.33] },
  { key: "coin.3", position: [-7.044, 1.97, -1.33] },
  { key: "coin.4", position: [-7.044, 1.97, -2.33] },
  { key: "coin.5", position: [-11.773, 2.549, -2.282] },
  { key: "coin.6", position: [-14.811, 1.689, 0.329] },
  { key: "coin.7", position: [-14.811, 2.689, 0.329] },
  { key: "coin.8", position: [-14.965, 0.802, 3.994] },
  { key: "coin.9", position: [0, 5, -6] },
  { key: "coin.10", position: [-6.709, 5.339, -2.004] },
  { key: "coin.11", position: [-18.979, 1.775, 2.862] },
  { key: "coin.12", position: [-22.117, 2.561, -4.757] },
  { key: "coin.13", position: [-22.117, 3.321, -4.757] },
];

export const CLOUDS: readonly CloudSpec[] = [
  { key: "cloud.0", position: [1.55, 1.107, -2.666], yawDegrees: 0, scale: 1, hoverVelocity: 0.55, hoverRate: 1.1 },
  { key: "cloud.1", position: [3.335, 1.371, -4.193], yawDegrees: -14.5, scale: 1.403, hoverVelocity: 0.95, hoverRate: 1.45 },
  { key: "cloud.2", position: [-10.575, 2.038, -7.937], yawDegrees: -14.5, scale: 1.403, hoverVelocity: 0.7, hoverRate: 0.85 },
  { key: "cloud.3", position: [-9.468, 2.038, 11.509], yawDegrees: -45.1, scale: 1.403, hoverVelocity: 0.35, hoverRate: 1.75 },
  { key: "cloud.4", position: [-9.202, 2.795, 13.743], yawDegrees: -169.5, scale: 1.403, hoverVelocity: 1.25, hoverRate: 1.6 },
  { key: "cloud.5", position: [-14.305, 2.038, -8.242], yawDegrees: -25.4, scale: 2.699, hoverVelocity: 0.8, hoverRate: 0.95 },
  { key: "cloud.6", position: [-14.152, 2.038, 10.065], yawDegrees: -25.4, scale: 2.699, hoverVelocity: 1.45, hoverRate: 1.25 },
];

export const FLAG: FlagSpec = { key: "flag", position: [0, 3.481, -6], yawDegrees: 45 };

// Coin spin/bob (objects/coin.gd: rotate_y(2·dt); y += cos(time·5)·dt).
export const COIN_SPIN_RATE = 2;
export const COIN_BOB_RATE = 5;
export const COIN_BOB_VELOCITY = 1;
export const COIN_COLLECT_RADIUS = 0.9;

// Falling platform (objects/platform_falling.gd: fall_velocity += 15·dt).
export const FALLING_PLATFORM_GRAVITY = 15;
export const FALLING_PLATFORM_HALF_EXTENT = 1.0; // source Area3D box 2×0.1×2
export const FALLING_PLATFORM_SQUASH: Vec3 = [1.25, 1, 1.25];

// Brick. The glb is a 1-unit cube with its origin at the BOTTOM (AABB y=[0,1]),
// so the box collider must be lifted by half its height to wrap the visual.
export const BRICK_HALF_EXTENT = 0.5;
export const BRICK_COLLIDER_OFFSET: Vec3 = [0, 0.5, 0];
// Player capsule top above the body root: colliderOffsetY + halfHeight + radius.
export const PLAYER_CAPSULE_TOP_OFFSET =
  PLAYER_COLLIDER_OFFSET[1] + PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS;
