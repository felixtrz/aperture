import { describe, expect, it } from "vitest";

import {
  multiplyQuat,
  normalizeQuat,
  rotateVec3ByQuat,
  slerpQuat,
} from "@aperture-engine/physics";

describe("physics quaternion math", () => {
  it("normalizes degenerate and non-finite quaternions to identity", () => {
    expect(normalizeQuat([0, 0, 0, 0])).toEqual([0, 0, 0, 1]);
    expect(normalizeQuat([1e-12, 0, 0, 0])).toEqual([0, 0, 0, 1]);
    expect(normalizeQuat([Number.NaN, 0, 0, 1])).toEqual([0, 0, 0, 1]);
  });

  it("normalizes multiply results", () => {
    expectQuatClose(
      multiplyQuat([0, 0, 0, 2], quatFromZRotation(Math.PI / 2)),
      quatFromZRotation(Math.PI / 2),
    );
  });

  it("rotates vectors with normalized input quaternions", () => {
    expectVec3Close(
      rotateVec3ByQuat([1, 0, 0], [0, 0, Math.SQRT1_2 * 2, Math.SQRT1_2 * 2]),
      [0, 1, 0],
    );
  });

  it("slerps along the shortest normalized path", () => {
    expectQuatClose(slerpQuat([0, 0, 0, 1], [0, 0, -1, 0], 0.5), [
      0,
      0,
      -Math.SQRT1_2,
      Math.SQRT1_2,
    ]);
  });
});

function quatFromZRotation(radians: number): [number, number, number, number] {
  return [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];
}

function expectQuatClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index] ?? 0, 8);
  }
}

function expectVec3Close(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index] ?? 0, 8);
  }
}
