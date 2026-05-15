import { describe, expect, it } from "vitest";
import { mat4 as wgpuMat4 } from "wgpu-matrix";

import {
  mat4,
  makeOrthographic,
  makePerspective,
  transformPoint,
  type Mat4Like,
  type Vec3Like,
} from "../../src/index.js";

const CLOSE_TO = 5;

describe("Aperture projection math", () => {
  it("builds WebGPU perspective projection matrices with depth from zero to one", () => {
    const projection = makePerspective(Math.PI / 2, 1, 1, 11);

    expect(projection[0]).toBeCloseTo(1, CLOSE_TO);
    expect(projection[5]).toBeCloseTo(1, CLOSE_TO);
    expect(projection[10]).toBeCloseTo(-1.1, CLOSE_TO);
    expect(projection[11]).toBe(-1);
    expect(projection[14]).toBeCloseTo(-1.1, CLOSE_TO);

    expectVec3(transformPoint(projection, [0, 0, -1]), [0, 0, 0]);
    expectVec3(transformPoint(projection, [0, 0, -11]), [0, 0, 1]);
  });

  it("matches wgpu-matrix perspective output and preserves destinations", () => {
    const out = mat4();

    expect(makePerspective(Math.PI / 3, 16 / 9, 0.1, 100, out)).toBe(out);
    expectMat4(out, wgpuMat4.perspective(Math.PI / 3, 16 / 9, 0.1, 100));
  });

  it("builds WebGPU orthographic projection matrices with depth from zero to one", () => {
    const projection = makeOrthographic(-2, 2, -4, 4, 1, 11);

    expect(projection[0]).toBeCloseTo(0.5, CLOSE_TO);
    expect(projection[5]).toBeCloseTo(0.25, CLOSE_TO);
    expect(projection[10]).toBeCloseTo(-0.1, CLOSE_TO);
    expect(projection[14]).toBeCloseTo(-0.1, CLOSE_TO);

    expectVec3(transformPoint(projection, [-2, -4, -1]), [-1, -1, 0]);
    expectVec3(transformPoint(projection, [2, 4, -11]), [1, 1, 1]);
  });

  it("matches wgpu-matrix orthographic output and preserves destinations", () => {
    const out = mat4();

    expect(makeOrthographic(-2, 6, -4, 8, 0.1, 100, out)).toBe(out);
    expectMat4(out, wgpuMat4.ortho(-2, 6, -4, 8, 0.1, 100));
  });
});

function expectVec3(actual: Vec3Like | undefined, expected: Vec3Like): void {
  expect(actual).toBeDefined();

  if (actual === undefined) {
    return;
  }

  expect(actual[0]).toBeCloseTo(expected[0], CLOSE_TO);
  expect(actual[1]).toBeCloseTo(expected[1], CLOSE_TO);
  expect(actual[2]).toBeCloseTo(expected[2], CLOSE_TO);
}

function expectMat4(actual: Mat4Like, expected: Mat4Like): void {
  for (let index = 0; index < 16; index += 1) {
    expect(read(actual, index)).toBeCloseTo(read(expected, index), CLOSE_TO);
  }
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}.`);
  }

  return value;
}
