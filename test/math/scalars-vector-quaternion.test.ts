import { describe, expect, it } from "vitest";
import {
  clamp,
  clamp01,
  expSmoothingAlpha,
  hexColor,
  inverseLerp,
  lerp,
  lerpAngle,
  quatFromAxisAngle,
  quatFromEulerYXZ,
  quatLookAt,
  quatMultiply,
  remap,
  remapClamped,
  rotateVec3ByQuat,
  vec3Add,
  vec3Cross,
  vec3Distance,
  vec3Dot,
  vec3Length,
  vec3LengthSq,
  vec3Normalize,
  vec3ProjectOnPlane,
  vec3Scale,
  vec3Subtract,
} from "@aperture-engine/simulation";

describe("public math helpers", () => {
  it("provides scalar helpers for gameplay-facing interpolation", () => {
    expect(clamp(4, -1, 2)).toBe(2);
    expect(clamp01(-0.5)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(inverseLerp(15, 10, 20)).toBe(0.5);
    expect(remap(15, 10, 20, 0, 100)).toBe(50);
    expect(remapClamped(30, 10, 20, 0, 100)).toBe(100);
    expect(expSmoothingAlpha(0, 8)).toBe(0);
    expect(expSmoothingAlpha(1 / 60, 8)).toBeGreaterThan(0);
    expect(lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5)).toBeCloseTo(Math.PI);
    expect(hexColor(0xff8040, 0.5)).toEqual([1, 128 / 255, 64 / 255, 0.5]);
  });

  it("provides vec3 helpers with readonly tuple inputs", () => {
    expect(Array.from(vec3Add([1, 2, 3], [4, 5, 6]))).toEqual([5, 7, 9]);
    expect(Array.from(vec3Subtract([4, 6, 8], [1, 2, 3]))).toEqual([3, 4, 5]);
    expect(Array.from(vec3Scale([2, -3, 4], 2))).toEqual([4, -6, 8]);
    expect(vec3Dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(Array.from(vec3Cross([1, 0, 0], [0, 1, 0]))).toEqual([0, 0, 1]);
    expect(vec3Length([2, 3, 6])).toBe(7);
    expect(vec3LengthSq([2, 3, 6])).toBe(49);
    expect(vec3Distance([1, 2, 3], [3, 6, 9])).toBeCloseTo(Math.sqrt(56));
    expect(Array.from(vec3Normalize([0, 0, 2]))).toEqual([0, 0, 1]);
    expect(Array.from(vec3ProjectOnPlane([1, 2, 3], [0, 1, 0]))).toEqual([
      1, 0, 3,
    ]);
  });

  it("preserves the racing YXZ quaternion composition convention", () => {
    const x = 0.25;
    const y = -0.5;
    const z = 0.75;
    const expected = quatMultiply(
      quatMultiply(
        quatFromAxisAngle([0, 1, 0], y),
        quatFromAxisAngle([1, 0, 0], x),
      ),
      quatFromAxisAngle([0, 0, 1], z),
    );

    expect(Array.from(quatFromEulerYXZ(x, y, z))).toEqual(Array.from(expected));
  });

  it("builds look-at quaternions for cameras that face -Z", () => {
    const rotation = quatLookAt([0, 0, 10], [0, 0, 0]);
    expect(Array.from(rotateVec3ByQuat([0, 0, -1], rotation))).toEqual([
      0, 0, -1,
    ]);

    const angled = quatLookAt([10, 2, 0], [0, 2, 0]);
    const forward = rotateVec3ByQuat([0, 0, -1], angled);
    expect(forward[0]).toBeCloseTo(-1);
    expect(forward[1]).toBeCloseTo(0);
    expect(forward[2]).toBeCloseTo(0);
  });
});
