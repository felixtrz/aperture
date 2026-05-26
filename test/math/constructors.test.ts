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
  identityMat4,
  mat4,
  quat,
  quatIdentity,
  vec2,
  vec3,
  vec4,
  type Mat4Like,
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
