import { describe, expect, it } from "vitest";
import {
  sourceSpriteAlphaForFrame,
  sourceSpriteFrameForLife,
  type SpriteAnimationFrame,
} from "../../fps/src/lib/fps-effects.js";
import {
  IMPACT_EFFECT_SLOT_COUNT,
  WEAPONS,
  impactEffectKey,
} from "../../fps/src/lib/fps-data.js";

const IMPACT_FRAMES: readonly SpriteAnimationFrame[] = [
  [0, 0, 0.5, 0.5],
  [0.5, 0, 0.5, 0.5],
  [0, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
];

const MUZZLE_FRAMES: readonly SpriteAnimationFrame[] = [
  [0, 0, 0.5, 1],
  [0.5, 0, 0.5, 1],
  null,
];

describe("Starter Kit FPS sprite effects", () => {
  it("selects the four source impact frames across the 30fps shot animation", () => {
    expect(sourceSpriteFrameForLife(IMPACT_FRAMES, 1).atlasFrame).toBe(0);
    expect(sourceSpriteFrameForLife(IMPACT_FRAMES, 0.74).atlasFrame).toBe(1);
    expect(sourceSpriteFrameForLife(IMPACT_FRAMES, 0.49).atlasFrame).toBe(2);
    expect(sourceSpriteFrameForLife(IMPACT_FRAMES, 0.24).atlasFrame).toBe(3);
    expect(sourceSpriteFrameForLife(IMPACT_FRAMES, 0).visible).toBe(false);
  });

  it("uses source-style constant opacity instead of fading animated sprite frames", () => {
    const impactFrame = sourceSpriteFrameForLife(IMPACT_FRAMES, 0.24);
    const muzzleHiddenFrame = sourceSpriteFrameForLife(MUZZLE_FRAMES, 0.01);

    expect(sourceSpriteAlphaForFrame(impactFrame)).toBe(1);
    expect(muzzleHiddenFrame).toMatchObject({
      atlasFrame: 2,
      visible: false,
      uvRect: [0, 0, 1, 1],
    });
    expect(sourceSpriteAlphaForFrame(muzzleHiddenFrame)).toBe(0);
  });

  it("allocates one impact effect slot for each source blaster pellet", () => {
    const maxShotCount = Math.max(...WEAPONS.map((weapon) => weapon.shotCount));

    expect(IMPACT_EFFECT_SLOT_COUNT).toBe(maxShotCount);
    expect(IMPACT_EFFECT_SLOT_COUNT).toBe(3);
    expect(
      Array.from({ length: IMPACT_EFFECT_SLOT_COUNT }, (_, index) =>
        impactEffectKey(index),
      ),
    ).toEqual([
      "effect.impact-hit.0",
      "effect.impact-hit.1",
      "effect.impact-hit.2",
    ]);
  });
});
