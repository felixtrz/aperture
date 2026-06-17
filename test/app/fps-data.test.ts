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
