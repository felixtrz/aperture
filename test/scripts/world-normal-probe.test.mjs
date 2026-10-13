import { describe, expect, it } from "vitest";
import {
  WORLD_NORMAL_CASES,
  validateNormalReadback,
} from "../../tools/agent-benchmark/world-normal-cases.mjs";

describe("independent normal regression expectations", () => {
  it("distinguishes the old forward transform from the required inverse transpose", () => {
    const entry = WORLD_NORMAL_CASES.find((entry) => entry.id === "nonuniform");
    expect(entry.expectedNormal[0]).toBeCloseTo(1 / Math.sqrt(5), 6);
    expect(entry.expectedNormal[1]).toBeCloseTo(2 / Math.sqrt(5), 6);
    expect(entry.expectedNormal[0]).not.toBeCloseTo(2 / Math.sqrt(5), 6);
  });

  it("covers shear, reflection, tiny/large scale and all singular ranks without invalid oracle values", () => {
    expect(WORLD_NORMAL_CASES.map((entry) => entry.id)).toEqual([
      "identity",
      "nonuniform",
      "shear",
      "mirrored",
      "tiny-uniform",
      "huge-uniform",
      "rank-two",
      "rank-one",
      "rank-two-forward-fallback",
      "rank-one-local-fallback",
      "collapsed",
      "zero-normal",
    ]);
    expect(
      WORLD_NORMAL_CASES.every(
        (entry) =>
          entry.expectedNormal.every(Number.isFinite) &&
          Math.abs(Math.hypot(...entry.expectedNormal) - 1) < 1e-6,
      ),
    ).toBe(true);
    expect(
      WORLD_NORMAL_CASES.find((entry) => entry.id === "mirrored")
        .expectedOrientation,
    ).toBe(-1);
  });

  it("exercises both fallback choices for normals in singular-matrix kernels", () => {
    const rankTwo = WORLD_NORMAL_CASES.find((entry) => entry.id === "rank-two");
    const forwardFallback = WORLD_NORMAL_CASES.find(
      (entry) => entry.id === "rank-two-forward-fallback",
    );
    const rankOne = WORLD_NORMAL_CASES.find((entry) => entry.id === "rank-one");
    const localFallback = WORLD_NORMAL_CASES.find(
      (entry) => entry.id === "rank-one-local-fallback",
    );

    // The same rank-two world needs a usable cofactor for one normal and a
    // forward fallback for another; determinant/rank alone cannot choose it.
    expect(forwardFallback.world).toEqual(rankTwo.world);
    expect(forwardFallback.normal).toEqual([0, 1, 0]);
    expect(forwardFallback.expectedNormal).toEqual([0, 1, 0]);
    // The same rank-one world maps this normal to zero, requiring its local
    // direction rather than the arbitrary +Y final fallback.
    expect(localFallback.world).toEqual(rankOne.world);
    expect(localFallback.normal).toEqual([1, 0, 0]);
    expect(localFallback.expectedNormal).toEqual([1, 0, 0]);
  });

  it("rejects native vectors with wrong orientation, NaNs or nonorthogonal tangent frames", () => {
    expect(() => validateNormalReadback([])).toThrow(/size/);
    const data = WORLD_NORMAL_CASES.flatMap((entry) => [
      ...entry.expectedNormal,
      entry.expectedOrientation,
      0,
      0,
      1,
      0,
    ]);
    // None of these case normals has a z component except shear; use a robust
    // independently constructed cross product for each unit-test fixture frame.
    WORLD_NORMAL_CASES.forEach((entry, index) => {
      const axis =
        Math.abs(entry.expectedNormal[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
      const n = entry.expectedNormal,
        tangent = [
          axis[1] * n[2] - axis[2] * n[1],
          axis[2] * n[0] - axis[0] * n[2],
          axis[0] * n[1] - axis[1] * n[0],
        ],
        length = Math.hypot(...tangent);
      data.splice(index * 8 + 4, 3, ...tangent.map((value) => value / length));
    });
    expect(validateNormalReadback(data)).toHaveLength(12);
    const wrong = [...data];
    wrong[3] = -1;
    expect(() => validateNormalReadback(wrong)).toThrow(/identity/);
    const invalid = [...data];
    invalid[0] = NaN;
    expect(() => validateNormalReadback(invalid)).toThrow(/identity/);
  });
});
