import { describe, expect, it } from "vitest";
import {
  easeInBack,
  easeInBounce,
  easeInCirc,
  easeInCubic,
  easeInElastic,
  easeInExpo,
  easeInOutBack,
  easeInOutBounce,
  easeInOutCirc,
  easeInOutCubic,
  easeInOutElastic,
  easeInOutExpo,
  easeInOutQuad,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutSine,
  easeInQuad,
  easeInQuart,
  easeInQuint,
  easeInSine,
  easeLinear,
  easeOutBack,
  easeOutBounce,
  easeOutCirc,
  easeOutCubic,
  easeOutElastic,
  easeOutExpo,
  easeOutQuad,
  easeOutQuart,
  easeOutQuint,
  easeOutSine,
  type EasingFunction,
} from "@aperture-engine/math";

const SAMPLES = 256;
const BOUNDARY_TOLERANCE = 1e-9;

const ALL: ReadonlyArray<readonly [string, EasingFunction]> = [
  ["easeLinear", easeLinear],
  ["easeInQuad", easeInQuad],
  ["easeOutQuad", easeOutQuad],
  ["easeInOutQuad", easeInOutQuad],
  ["easeInCubic", easeInCubic],
  ["easeOutCubic", easeOutCubic],
  ["easeInOutCubic", easeInOutCubic],
  ["easeInQuart", easeInQuart],
  ["easeOutQuart", easeOutQuart],
  ["easeInOutQuart", easeInOutQuart],
  ["easeInQuint", easeInQuint],
  ["easeOutQuint", easeOutQuint],
  ["easeInOutQuint", easeInOutQuint],
  ["easeInSine", easeInSine],
  ["easeOutSine", easeOutSine],
  ["easeInOutSine", easeInOutSine],
  ["easeInExpo", easeInExpo],
  ["easeOutExpo", easeOutExpo],
  ["easeInOutExpo", easeInOutExpo],
  ["easeInCirc", easeInCirc],
  ["easeOutCirc", easeOutCirc],
  ["easeInOutCirc", easeInOutCirc],
  ["easeInBack", easeInBack],
  ["easeOutBack", easeOutBack],
  ["easeInOutBack", easeInOutBack],
  ["easeInElastic", easeInElastic],
  ["easeOutElastic", easeOutElastic],
  ["easeInOutElastic", easeInOutElastic],
  ["easeInBounce", easeInBounce],
  ["easeOutBounce", easeOutBounce],
  ["easeInOutBounce", easeInOutBounce],
];

// Families whose curves are non-decreasing on [0, 1] (Back/Elastic overshoot
// and Bounce oscillates, so they are deliberately excluded).
const MONOTONIC: ReadonlyArray<readonly [string, EasingFunction]> = ALL.filter(
  ([name]) => !/Back|Elastic|Bounce/.test(name),
);

const IN_OUT_PAIRS: ReadonlyArray<
  readonly [string, EasingFunction, EasingFunction]
> = [
  ["Quad", easeInQuad, easeOutQuad],
  ["Cubic", easeInCubic, easeOutCubic],
  ["Quart", easeInQuart, easeOutQuart],
  ["Quint", easeInQuint, easeOutQuint],
  ["Sine", easeInSine, easeOutSine],
  ["Expo", easeInExpo, easeOutExpo],
  ["Circ", easeInCirc, easeOutCirc],
  ["Back", easeInBack, easeOutBack],
  ["Elastic", easeInElastic, easeOutElastic],
  ["Bounce", easeInBounce, easeOutBounce],
];

describe("easing boundary conditions", () => {
  it("maps 0 -> 0 and 1 -> 1 for every function", () => {
    for (const [name, ease] of ALL) {
      expect
        .soft(Math.abs(ease(0)), `${name}(0)`)
        .toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
      expect
        .soft(Math.abs(ease(1) - 1), `${name}(1)`)
        .toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }
  });

  it("passes through 0.5 at the midpoint of every InOut curve", () => {
    for (const [name, ease] of ALL) {
      if (!name.includes("InOut")) {
        continue;
      }
      expect.soft(ease(0.5), `${name}(0.5)`).toBeCloseTo(0.5, 9);
    }
  });
});

describe("easing curve shapes", () => {
  it("is non-decreasing for the monotonic families", () => {
    for (const [name, ease] of MONOTONIC) {
      let previous = ease(0);
      for (let step = 1; step <= SAMPLES; step += 1) {
        const value = ease(step / SAMPLES);
        expect
          .soft(value, `${name} at t=${step / SAMPLES}`)
          .toBeGreaterThanOrEqual(previous - 1e-12);
        previous = value;
      }
    }
  });

  it("keeps the bounce family inside [0, 1]", () => {
    for (const [name, ease] of [
      ["easeInBounce", easeInBounce],
      ["easeOutBounce", easeOutBounce],
      ["easeInOutBounce", easeInOutBounce],
    ] as const) {
      for (let step = 0; step <= SAMPLES; step += 1) {
        const value = ease(step / SAMPLES);
        expect.soft(value, `${name}`).toBeGreaterThanOrEqual(-1e-12);
        expect.soft(value, `${name}`).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });

  it("overshoots where the family is designed to", () => {
    const min = (ease: EasingFunction): number => {
      let lowest = Number.POSITIVE_INFINITY;
      for (let step = 0; step <= SAMPLES; step += 1) {
        lowest = Math.min(lowest, ease(step / SAMPLES));
      }
      return lowest;
    };
    const max = (ease: EasingFunction): number => {
      let highest = Number.NEGATIVE_INFINITY;
      for (let step = 0; step <= SAMPLES; step += 1) {
        highest = Math.max(highest, ease(step / SAMPLES));
      }
      return highest;
    };

    expect(min(easeInBack)).toBeLessThan(-0.05);
    expect(max(easeOutBack)).toBeGreaterThan(1.05);
    expect(min(easeInElastic)).toBeLessThan(-0.05);
    expect(max(easeOutElastic)).toBeGreaterThan(1.05);
  });

  it("relates In and Out variants by reflection", () => {
    for (const [family, easeIn, easeOut] of IN_OUT_PAIRS) {
      for (let step = 0; step <= SAMPLES; step += 1) {
        const t = step / SAMPLES;
        expect
          .soft(easeIn(t), `${family} reflection at t=${t}`)
          .toBeCloseTo(1 - easeOut(1 - t), 9);
      }
    }
  });
});

describe("easing hand-checked values", () => {
  it("matches the canonical Penner closed forms", () => {
    expect(easeLinear(0.3)).toBeCloseTo(0.3, 12);
    expect(easeInQuad(0.5)).toBeCloseTo(0.25, 12);
    expect(easeOutQuad(0.25)).toBeCloseTo(0.4375, 12);
    expect(easeInOutQuad(0.25)).toBeCloseTo(0.125, 12);
    expect(easeInOutQuad(0.75)).toBeCloseTo(0.875, 12);
    expect(easeInCubic(0.5)).toBeCloseTo(0.125, 12);
    expect(easeInQuart(0.5)).toBeCloseTo(0.0625, 12);
    expect(easeInQuint(0.5)).toBeCloseTo(0.03125, 12);
    expect(easeInSine(1 / 3)).toBeCloseTo(1 - Math.cos(Math.PI / 6), 12);
    expect(easeInExpo(0.5)).toBeCloseTo(2 ** -5, 12);
    expect(easeOutExpo(0.5)).toBeCloseTo(1 - 2 ** -5, 12);
    expect(easeInCirc(0.6)).toBeCloseTo(1 - 0.8, 12);
    expect(easeOutBounce(0.5)).toBeCloseTo(0.765625, 12);
    expect(easeInBounce(0.5)).toBeCloseTo(1 - 0.765625, 12);
  });
});
