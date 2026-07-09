import { describe, expect, it } from "vitest";
import {
  mat4 as wgpuMat4,
  quat as wgpuQuat,
  vec2 as wgpuVec2,
  vec3 as wgpuVec3,
  vec4 as wgpuVec4,
} from "wgpu-matrix";
import {
  color,
  colorTuple,
  identityMat4,
  mat4,
  mat4Tuple,
  quat,
  quatIdentity,
  quatTuple,
  vec2,
  vec2Tuple,
  vec3,
  vec3Tuple,
  vec4,
  vec4Tuple,
  type Mat4Like,
  type Mat4Tuple,
  type Vec3Tuple,
} from "@aperture-engine/simulation";

describe("Aperture math constructors", () => {
  it("wraps wgpu-matrix vector, quaternion, and color constructors", () => {
    expectArray(vec2(1, 2), wgpuVec2.create(1, 2));
    expectArray(vec3(1, 2, 3), wgpuVec3.create(1, 2, 3));
    expectArray(vec4(1, 2, 3, 4), wgpuVec4.create(1, 2, 3, 4));
    expectArray(color(0.25, 0.5, 0.75, 1), wgpuVec4.create(0.25, 0.5, 0.75, 1));
    expectArray(quat(1, 2, 3, 4), wgpuQuat.create(1, 2, 3, 4));
    expectArray(quatIdentity(), wgpuQuat.identity());
  });

  it("wraps wgpu-matrix matrix construction and identity destinations", () => {
    const values = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ] as const;
    const out = mat4();

    expectArray(mat4(), wgpuMat4.create());
    expectMat4(mat4(values), wgpuMat4.set(...values));
    expect(identityMat4(out)).toBe(out);
    expectMat4(out, wgpuMat4.identity());
  });
});

describe("Aperture math tuple constructors", () => {
  it("converts array-producing expressions into typed tuples", () => {
    // `.map()` output is `number[]` — the exact shape TypeScript refuses to
    // cast to a fixed-length tuple without the checked constructors.
    const mapped = [1, 2, 3].map((value) => value * 2);
    const v3: Vec3Tuple = vec3Tuple(mapped);
    expect(v3).toEqual([2, 4, 6]);

    expect(vec2Tuple([1, 2])).toEqual([1, 2]);
    expect(vec4Tuple([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(quatTuple([0, 0, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(colorTuple([0.25, 0.5, 0.75, 1])).toEqual([0.25, 0.5, 0.75, 1]);

    const m: Mat4Tuple = mat4Tuple(Array.from({ length: 16 }, (_, i) => i));
    expect(m).toHaveLength(16);
    expect(m[15]).toBe(15);
  });

  it("accepts typed arrays as input", () => {
    expect(vec3Tuple(new Float32Array([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(mat4Tuple(new Float32Array(16))[0]).toBe(0);
  });

  it("rejects inputs whose length does not match the tuple", () => {
    expect(() => vec2Tuple([1])).toThrow(RangeError);
    expect(() => vec3Tuple([1, 2, 3, 4])).toThrow(
      "Vec3Tuple requires exactly 3 element(s), received 4.",
    );
    expect(() => vec4Tuple([])).toThrow(RangeError);
    expect(() => quatTuple([1, 2, 3])).toThrow(RangeError);
    expect(() => mat4Tuple([1, 2, 3])).toThrow(
      "Mat4Tuple requires exactly 16 element(s), received 3.",
    );
  });
});

function expectArray(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
): void {
  expect(actual).toBeInstanceOf(Float32Array);
  expect(actual.length).toBe(expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    expect(actual[index]).toBe(expected[index]);
  }
}

function expectMat4(actual: Mat4Like, expected: Mat4Like): void {
  for (let index = 0; index < 16; index += 1) {
    expect(actual[index]).toBe(expected[index]);
  }
}
