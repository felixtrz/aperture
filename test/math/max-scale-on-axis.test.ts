import { describe, expect, it } from "vitest";
import { mat4, quat } from "wgpu-matrix";
import { maxScaleOnAxis, type Mat4Like } from "@aperture-engine/simulation";

function asMat4(value: unknown): Mat4Like {
  return value as Mat4Like;
}

describe("maxScaleOnAxis", () => {
  it("returns 1 for the identity and pure rotations", () => {
    expect(maxScaleOnAxis(asMat4(mat4.identity()))).toBeCloseTo(1, 6);

    const rotated = mat4.fromQuat(quat.fromEuler(0.4, 1.1, -0.7, "xyz"));
    expect(maxScaleOnAxis(asMat4(rotated))).toBeCloseTo(1, 6);
  });

  it("returns the largest axis scale for non-uniform scaling", () => {
    expect(maxScaleOnAxis(asMat4(mat4.scaling([2, 3, 0.5])))).toBeCloseTo(3, 6);
    expect(maxScaleOnAxis(asMat4(mat4.scaling([10, 1, 1])))).toBeCloseTo(10, 6);
  });

  it("is rotation-invariant and ignores translation", () => {
    const composed = mat4.translation([5, -2, 9]);
    mat4.multiply(
      composed,
      mat4.fromQuat(quat.fromEuler(0.3, 0.9, 0.1, "xyz")),
      composed,
    );
    mat4.multiply(composed, mat4.scaling([0.25, 4, 1]), composed);

    expect(maxScaleOnAxis(asMat4(composed))).toBeCloseTo(4, 5);
  });
});
