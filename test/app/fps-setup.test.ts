import { describe, expect, it } from "vitest";

import { WEAPON_VIEWMODEL_MATERIALS } from "../../showcase/fps/src/systems/setup.system.js";

describe("Starter Kit FPS setup", () => {
  it("preserves the source GLB material render state for weapon self-occlusion", () => {
    expect(WEAPON_VIEWMODEL_MATERIALS).not.toHaveProperty("renderState");
  });
});
