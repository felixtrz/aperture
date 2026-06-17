import { describe, expect, it } from "vitest";
import {
  PLAYER_BODY_COLLIDER_OFFSET,
  PLAYER_BODY_EYE_OFFSET,
  PLAYER_BODY_HALF_HEIGHT,
  PLAYER_BODY_RADIUS,
  PLAYER_BODY_START,
  PLAYER_EYE_HEIGHT,
  PLAYER_START,
  PLATFORM_LARGE_GRASS_DECORATIONS,
  SOURCE_PLAYER_CAPSULE_HALF_HEIGHT,
  SOURCE_PLAYER_CAPSULE_HEIGHT,
  SOURCE_PLAYER_CAPSULE_RADIUS,
  SOURCE_PLAYER_COLLIDER_CENTER_Y,
  SOURCE_PLAYER_HEAD_Y,
  SOURCE_PLAYER_ROOT_Y,
  SOURCE_WEAPON_CAMERA_ITEM_FOV,
  SOURCE_WEAPON_CONTAINER_INITIAL_POSITION,
  SOURCE_WEAPON_CONTAINER_OFFSET,
  SOURCE_WEAPON_MODEL_POSITION,
  SOURCE_WEAPON_MUZZLE_POSITION,
  SOURCE_WEAPON_SHOT_KICK,
  SOURCE_WEAPON_SWITCH_DROP_OFFSET,
  SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE,
  SOURCE_WEAPON_VIEW_POSITION,
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

  it("derives player weapon view data from the source Player scene and Weapon resources", () => {
    expect(SOURCE_WEAPON_CONTAINER_INITIAL_POSITION).toEqual([1.2, -1, -2.25]);
    expect(SOURCE_WEAPON_CONTAINER_OFFSET).toEqual([1.2, -1.1, -2.75]);
    expect(SOURCE_WEAPON_MODEL_POSITION).toEqual([0, 0, 0]);
    expect(SOURCE_WEAPON_VIEW_POSITION).toEqual([1.2, -1.1, -2.75]);
    expect(SOURCE_WEAPON_MUZZLE_POSITION).toEqual([0.1, -0.4, 1.5]);
    expect(SOURCE_WEAPON_CAMERA_ITEM_FOV).toBe(40);
    expect(SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE).toBeCloseTo(1 / 30, 10);
    expect(SOURCE_WEAPON_SHOT_KICK).toBe(0.25);
    expect(SOURCE_WEAPON_SWITCH_DROP_OFFSET).toBe(1);

    expect(WEAPONS.map((weapon) => weapon.position)).toEqual([
      [1.2, -1.1, -2.75],
      [1.2, -1.1, -2.75],
    ]);
    expect(WEAPONS.map((weapon) => weapon.rotationEulerDegrees)).toEqual([
      [0, 180, 0],
      [0, 180, 0],
    ]);
    expect(WEAPONS.map((weapon) => weapon.muzzlePosition)).toEqual([
      [0.1, -0.4, 1.5],
      [0.1, -0.4, 1.5],
    ]);
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
