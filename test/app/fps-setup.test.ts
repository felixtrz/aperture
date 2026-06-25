import { describe, expect, it } from "vitest";

import {
  FPS_SUN_SHADOW_SETTINGS,
  WEAPON_VIEWMODEL_MATERIALS,
} from "../../showcase/fps/src/systems/setup.system.js";

describe("Starter Kit FPS setup", () => {
  it("preserves the source GLB material render state for weapon self-occlusion", () => {
    expect(WEAPON_VIEWMODEL_MATERIALS).not.toHaveProperty("renderState");
  });

  it("uses a fixed sun shadow footprint so sharpness does not depend on visible casters", () => {
    expect(FPS_SUN_SHADOW_SETTINGS).toMatchObject({
      mapSize: 4096,
      cascadeCount: 1,
      center: [2, 2, 0],
      orthographicSize: 42,
      near: 1,
      far: 72,
      lightDistance: 36,
    });
  });
});
