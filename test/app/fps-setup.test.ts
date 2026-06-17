import { describe, expect, it } from "vitest";

import { WEAPON_VIEWMODEL_MATERIALS } from "../../fps/src/systems/setup.system.js";

describe("Starter Kit FPS setup", () => {
  it("preserves source GLB culling while making the weapon viewmodel depthless", () => {
    expect(WEAPON_VIEWMODEL_MATERIALS.renderState).not.toHaveProperty(
      "cullMode",
    );
    expect(WEAPON_VIEWMODEL_MATERIALS.renderState.depth).toEqual({
      test: false,
      write: false,
      compare: "always",
    });
  });
});
