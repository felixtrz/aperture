import { describe, expect, it } from "vitest";
import {
  CLOUDS,
  FPS_ALL_RENDER_LAYER_MASK,
  FPS_WEAPON_LAYER_MASK,
  FPS_WORLD_LAYER_MASK,
  PLAYER_BODY_COLLIDER_OFFSET,
  PLAYER_BODY_EYE_OFFSET,
  PLAYER_BODY_HALF_HEIGHT,
  PLAYER_BODY_RADIUS,
  PLAYER_BODY_START,
  PLAYER_EYE_HEIGHT,
  PLAYER_START,
  PLATFORM_LARGE_GRASS_DECORATIONS,
  SOURCE_CLOUD_RANDOM_MAX,
  SOURCE_CLOUD_RANDOM_MIN,
  SOURCE_ENEMY_ATTACK_DAMAGE,
  SOURCE_ENEMY_ATTACK_DISTANCE,
  SOURCE_ENEMY_ATTACK_INTERVAL,
  SOURCE_ENEMY_HITBOX_OFFSET,
  SOURCE_ENEMY_HITBOX_RADIUS,
  SOURCE_ENEMY_HOVER_AMPLITUDE,
  SOURCE_ENEMY_HOVER_RATE,
  SOURCE_ENEMY_HOVER_VELOCITY,
  SOURCE_ENEMY_MUZZLE_OFFSETS,
  SOURCE_ENEMY_MUZZLE_ROLL_RANGE,
  SOURCE_ENEMY_RAYCAST_TARGET,
  SOURCE_ENV_AMBIENT_COLOR,
  SOURCE_ENV_AMBIENT_INTENSITY,
  SOURCE_ENV_BACKGROUND_COLOR,
  SOURCE_GAMEPAD_LOOK_SENSITIVITY,
  SOURCE_LOOK_LERP_RATE,
  SOURCE_LOOK_PITCH_LIMIT,
  SOURCE_MOUSE_SENSITIVITY,
  SOURCE_MOVEMENT_LERP_RATE,
  SOURCE_PLAYER_CAPSULE_HALF_HEIGHT,
  SOURCE_PLAYER_CAPSULE_HEIGHT,
  SOURCE_PLAYER_CAPSULE_RADIUS,
  SOURCE_PLAYER_CAMERA_CULL_MASK,
  SOURCE_PLAYER_CAMERA_FOV,
  SOURCE_PLAYER_COLLIDER_CENTER_Y,
  SOURCE_PLAYER_HEAD_Y,
  SOURCE_PLAYER_ROOT_Y,
  SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT,
  SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT,
  SOURCE_SKY_ENERGY_MULTIPLIER,
  SOURCE_SUN_ROTATION,
  SOURCE_SUN_SHADOW_STRENGTH,
  SOURCE_WEAPON_CAMERA_CULL_MASK,
  SOURCE_WEAPON_CAMERA_ITEM_FOV,
  SOURCE_WEAPON_CONTAINER_INITIAL_POSITION,
  SOURCE_WEAPON_CONTAINER_OFFSET,
  SOURCE_WEAPON_MODEL_POSITION,
  SOURCE_WEAPON_MODEL_SCALE,
  SOURCE_WEAPON_MUZZLE_POSITION,
  SOURCE_WEAPON_SHOT_KICK,
  SOURCE_WEAPON_SWITCH_DROP_OFFSET,
  SOURCE_WEAPON_SWITCH_HIDE_DURATION,
  SOURCE_WEAPON_SWITCH_RAISE_RATE,
  SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE,
  SOURCE_WEAPON_VIEW_POSITION,
  ENEMY_MUZZLE_OFFSETS,
  WEAPONS,
  platformLargeGrassDecorationKey,
} from "../../fps/src/lib/fps-data.js";

describe("Starter Kit FPS source data", () => {
  it("derives player body/capsule data from the source Player scene", () => {
    expect(SOURCE_PLAYER_ROOT_Y).toBe(0.5);
    expect(SOURCE_PLAYER_HEAD_Y).toBe(1);
    expect(SOURCE_PLAYER_COLLIDER_CENTER_Y).toBe(0.55);
    expect(SOURCE_PLAYER_CAPSULE_RADIUS).toBe(0.3);
    expect(SOURCE_PLAYER_CAPSULE_HEIGHT).toBe(1);
    expect(SOURCE_PLAYER_CAMERA_FOV).toBe(80);
    expect(SOURCE_PLAYER_CAMERA_CULL_MASK).toBe(1_048_573);
    expect(SOURCE_WEAPON_CAMERA_CULL_MASK).toBe(1_047_554);
    expect(SOURCE_PLAYER_CAMERA_CULL_MASK & 1).toBe(1);
    expect(SOURCE_PLAYER_CAMERA_CULL_MASK & 2).toBe(0);
    expect(SOURCE_WEAPON_CAMERA_CULL_MASK & 1).toBe(0);
    expect(SOURCE_WEAPON_CAMERA_CULL_MASK & 2).toBe(2);
    expect(FPS_WORLD_LAYER_MASK).toBe(1);
    expect(FPS_WEAPON_LAYER_MASK).toBe(2);
    expect(FPS_ALL_RENDER_LAYER_MASK).toBe(3);

    expect(SOURCE_PLAYER_CAPSULE_HALF_HEIGHT).toBeCloseTo(0.2, 10);
    expect(PLAYER_BODY_RADIUS).toBe(SOURCE_PLAYER_CAPSULE_RADIUS);
    expect(PLAYER_BODY_HALF_HEIGHT).toBeCloseTo(
      SOURCE_PLAYER_CAPSULE_HALF_HEIGHT,
      10,
    );
    expect(PLAYER_BODY_COLLIDER_OFFSET).toEqual([0, 0.55, 0]);
    expect(PLAYER_BODY_EYE_OFFSET).toBe(1);
    expect(PLAYER_BODY_START).toEqual([0, 0.5, 0]);
    expect(PLAYER_EYE_HEIGHT).toBe(1.5);
    expect(PLAYER_START).toEqual([0, 1.5, 0]);
  });

  it("derives player look constants from the source Player script", () => {
    expect(SOURCE_MOUSE_SENSITIVITY).toBe(700);
    expect(SOURCE_MOVEMENT_LERP_RATE).toBe(10);
    expect(SOURCE_GAMEPAD_LOOK_SENSITIVITY).toBe(0.075);
    expect(SOURCE_LOOK_LERP_RATE).toBe(25);
    expect(SOURCE_LOOK_PITCH_LIMIT).toBeCloseTo(Math.PI / 2, 10);
    expect(SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT).toBe(26);
    expect(SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT).toBeCloseTo(26 / 700, 10);
  });

  it("derives player weapon view data from the source Player scene and Weapon resources", () => {
    expect(SOURCE_WEAPON_CONTAINER_INITIAL_POSITION).toEqual([1.2, -1, -2.25]);
    expect(SOURCE_WEAPON_CONTAINER_OFFSET).toEqual([1.2, -1.1, -2.75]);
    expect(SOURCE_WEAPON_MODEL_POSITION).toEqual([0, 0, 0]);
    expect(SOURCE_WEAPON_MODEL_SCALE).toEqual([1, 1, 1]);
    expect(SOURCE_WEAPON_VIEW_POSITION).toEqual([1.2, -1.1, -2.75]);
    expect(SOURCE_WEAPON_MUZZLE_POSITION).toEqual([0.1, -0.4, 1.5]);
    expect(SOURCE_WEAPON_CAMERA_ITEM_FOV).toBe(40);
    expect(SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE).toBeCloseTo(1 / 30, 10);
    expect(SOURCE_WEAPON_SHOT_KICK).toBe(0.25);
    expect(SOURCE_WEAPON_SWITCH_DROP_OFFSET).toBe(1);
    expect(SOURCE_WEAPON_SWITCH_HIDE_DURATION).toBe(0.1);
    expect(SOURCE_WEAPON_SWITCH_RAISE_RATE).toBe(10);

    expect(WEAPONS.map((weapon) => weapon.position)).toEqual([
      [1.2, -1.1, -2.75],
      [1.2, -1.1, -2.75],
    ]);
    expect(WEAPONS.map((weapon) => weapon.rotationEulerDegrees)).toEqual([
      [0, 180, 0],
      [0, 180, 0],
    ]);
    expect(WEAPONS.map((weapon) => weapon.scale)).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(WEAPONS.map((weapon) => weapon.muzzlePosition)).toEqual([
      [0.1, -0.4, 1.5],
      [0.1, -0.4, 1.5],
    ]);
  });

  it("keeps cloud hover data inside the source cloud random range", () => {
    expect(SOURCE_CLOUD_RANDOM_MIN).toBe(0.1);
    expect(SOURCE_CLOUD_RANDOM_MAX).toBe(2);
    expect(CLOUDS).toHaveLength(11);
    expect(new Set(CLOUDS.map((cloud) => cloud.key)).size).toBe(CLOUDS.length);

    for (const cloud of CLOUDS) {
      expect(cloud.hoverVelocity).toBeGreaterThanOrEqual(
        SOURCE_CLOUD_RANDOM_MIN,
      );
      expect(cloud.hoverVelocity).toBeLessThanOrEqual(SOURCE_CLOUD_RANDOM_MAX);
      expect(cloud.hoverRate).toBeGreaterThanOrEqual(SOURCE_CLOUD_RANDOM_MIN);
      expect(cloud.hoverRate).toBeLessThanOrEqual(SOURCE_CLOUD_RANDOM_MAX);
    }
  });

  it("derives enemy scene and script constants from the source Enemy files", () => {
    expect(SOURCE_ENEMY_HITBOX_OFFSET).toEqual([0, 0.25, 0]);
    expect(SOURCE_ENEMY_HITBOX_RADIUS).toBe(0.75);
    expect(SOURCE_ENEMY_RAYCAST_TARGET).toEqual([0, 0, 5]);
    expect(SOURCE_ENEMY_ATTACK_DISTANCE).toBe(5);
    expect(SOURCE_ENEMY_ATTACK_INTERVAL).toBe(0.25);
    expect(SOURCE_ENEMY_ATTACK_DAMAGE).toBe(5);
    expect(SOURCE_ENEMY_HOVER_VELOCITY).toBe(1);
    expect(SOURCE_ENEMY_HOVER_RATE).toBe(5);
    expect(SOURCE_ENEMY_HOVER_AMPLITUDE).toBeCloseTo(0.2, 10);
    expect(SOURCE_ENEMY_MUZZLE_OFFSETS).toEqual([
      [-0.45, 0.3, 0.4],
      [0.45, 0.3, 0.4],
    ]);
    expect(ENEMY_MUZZLE_OFFSETS).toBe(SOURCE_ENEMY_MUZZLE_OFFSETS);
    expect(SOURCE_ENEMY_MUZZLE_ROLL_RANGE).toBeCloseTo(Math.PI / 4, 10);
  });

  it("derives supported environment and sun values from the source main scene", () => {
    expect(SOURCE_ENV_BACKGROUND_COLOR).toEqual([
      0x5c / 0xff,
      0x64 / 0xff,
      0x76 / 0xff,
      1,
    ]);
    expect(SOURCE_ENV_AMBIENT_COLOR).toEqual([
      0xa9 / 0xff,
      0xb1 / 0xff,
      0xc5 / 0xff,
      1,
    ]);
    expect(SOURCE_ENV_AMBIENT_INTENSITY).toBe(1);
    expect(SOURCE_SKY_ENERGY_MULTIPLIER).toBe(0.5);
    expect(SOURCE_SUN_SHADOW_STRENGTH).toBe(0.75);
    expect(SOURCE_SUN_ROTATION[0]).toBeCloseTo(0.22707267, 8);
    expect(SOURCE_SUN_ROTATION[1]).toBeCloseTo(-0.76437232, 8);
    expect(SOURCE_SUN_ROTATION[2]).toBeCloseTo(-0.35643233, 8);
    expect(SOURCE_SUN_ROTATION[3]).toBeCloseTo(0.48695873, 8);
  });

  it("keeps platform-large-grass child decorations from the source packed scene", () => {
    expect(PLATFORM_LARGE_GRASS_DECORATIONS).toHaveLength(3);
    expect(
      PLATFORM_LARGE_GRASS_DECORATIONS.map((decoration) =>
        platformLargeGrassDecorationKey(
          "level.platform-large-grass.0",
          decoration,
        ),
      ),
    ).toEqual([
      "level.platform-large-grass.0.grass.0",
      "level.platform-large-grass.0.grass-small.0",
      "level.platform-large-grass.0.grass.1",
    ]);

    expect(PLATFORM_LARGE_GRASS_DECORATIONS[0]).toMatchObject({
      assetId: "grass",
      position: [-1.57788, 0.5, 1.72158],
    });
    expect(PLATFORM_LARGE_GRASS_DECORATIONS[2]).toMatchObject({
      assetId: "grass",
      yawDegrees: -38.5,
    });
  });
});
