import { describe, expect, it } from "vitest";
import {
  PLATFORM_LARGE_GRASS_DECORATIONS,
  platformLargeGrassDecorationKey,
} from "../../fps/src/lib/fps-data.js";

describe("Starter Kit FPS source data", () => {
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
