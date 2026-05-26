import { describe, expect, it } from "vitest";
import {
  mat4 as wgpuMat4,
  quat as wgpuQuat,
  vec3 as wgpuVec3,
} from "wgpu-matrix";
import {
  composeTrsMatrix,
  decomposeTrsMatrix,
  identityMat4,
  invertMat4,
  mat4,
  multiplyMat4,
  quatFromAxisAngle,
  transformPoint,
  transformVector,
  type QuatLike,
  type Mat4Like,
  type Vec3Like,
} from "@aperture-engine/simulation";

const CLOSE_TO = 5;

describe("Aperture matrix math", () => {
  it("composes TRS matrices using x/y/z/w quaternions and column-major layout", () => {
    const rotation = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const matrix = composeTrsMatrix([1, 2, 3], rotation, [2, 3, 4]);

    expectVec3(transformPoint(matrix, [1, 0, 0]), [1, 4, 3]);
    expectVec3(transformVector(matrix, [0, 1, 0]), [-3, 0, 0]);
  });

  it("matches wgpu-matrix TRS composition and preserves destinations", () => {
    const translation = [3, -2, 5] as const;
    const rotation = quatFromAxisAngle([0, 2, 0], Math.PI / 3);
    const scale = [2, 4, 6] as const;
    const out = mat4();

    const expected = wgpuMat4.fromQuat(rotation);
    wgpuMat4.scale(expected, scale, expected);
    wgpuMat4.setTranslation(expected, translation, expected);

    expect(composeTrsMatrix(translation, rotation, scale, out)).toBe(out);
    expectMat4(out, expected);
  });

  it("decomposes affine TRS matrices and preserves round-trip composition", () => {
    const translation = [4, 5, 6] as const;
    const rotation = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const scale = [2, 3, 4] as const;
    const matrix = composeTrsMatrix(translation, rotation, scale);

    const decomposed = decomposeTrsMatrix(matrix);

    expect(decomposed).not.toBeNull();
    expectVec3(decomposed?.translation, translation);
    expectVec3(decomposed?.scale, scale);
    expectEquivalentQuat(decomposed?.rotation, rotation);
    expectMat4(
      composeTrsMatrix(
        decomposed?.translation,
        decomposed?.rotation,
        decomposed?.scale,
      ),
      matrix,
    );
  });

  it("decomposes reflected matrices with signed scale", () => {
    const rotation = quatFromAxisAngle([0, 1, 0], Math.PI / 4);
    const matrix = composeTrsMatrix([1, 2, 3], rotation, [-2, 3, 4]);

    const decomposed = decomposeTrsMatrix(matrix);

    expect(decomposed).not.toBeNull();
    expectVec3(decomposed?.translation, [1, 2, 3]);
    expectVec3(decomposed?.scale, [-2, 3, 4]);
    expectMat4(
      composeTrsMatrix(
        decomposed?.translation,
        decomposed?.rotation,
        decomposed?.scale,
      ),
      matrix,
    );
  });

  it("rejects non-TRS affine and perspective matrices", () => {
    const shear = identityMat4();
    shear[4] = 0.5;

    const perspective = identityMat4();
    perspective[3] = 0.25;

    expect(decomposeTrsMatrix(shear)).toBeNull();
    expect(decomposeTrsMatrix(perspective)).toBeNull();
  });

  it("multiplies and inverts matrices deterministically", () => {
    const matrix = composeTrsMatrix(
      [3, -2, 5],
      quatFromAxisAngle([0, 1, 0], Math.PI / 3),
      [2, 2, 2],
    );
    const inverse = invertMat4(matrix);

    expect(inverse).not.toBeNull();
    expectMat4(multiplyMat4(matrix, inverse as Mat4Like), identityMat4());
  });

  it("matches wgpu-matrix matrix operations and destination reuse", () => {
    const left = composeTrsMatrix(
      [1, 2, 3],
      quatFromAxisAngle([1, 0, 0], Math.PI / 4),
      [1, 2, 1],
    );
    const right = composeTrsMatrix(
      [-2, 0, 4],
      quatFromAxisAngle([0, 0, 1], -Math.PI / 6),
      [3, 1, 2],
    );
    const multiplied = mat4();
    const inverted = mat4();

    expect(multiplyMat4(left, right, multiplied)).toBe(multiplied);
    expectMat4(multiplied, wgpuMat4.multiply(left, right));

    expect(invertMat4(left, inverted)).toBe(inverted);
    expectMat4(inverted, wgpuMat4.inverse(left));
    expect(invertMat4(mat4())).toBeNull();
  });

  it("matches wgpu-matrix point and vector transforms", () => {
    const matrix = composeTrsMatrix(
      [3, -2, 5],
      quatFromAxisAngle([0, 0, 1], Math.PI / 2),
      [2, 3, 4],
    );
    const pointOut = new Float32Array(3);
    const vectorOut = new Float32Array(3);

    expect(transformPoint(matrix, [1, 2, 3], pointOut)).toBe(pointOut);
    expectVec3(pointOut, wgpuVec3.transformMat4([1, 2, 3], matrix));

    expect(transformVector(matrix, [1, 2, 3], vectorOut)).toBe(vectorOut);
    expectVec3(vectorOut, wgpuVec3.transformMat4Upper3x3([1, 2, 3], matrix));
  });

  it("normalizes axis-angle input before delegating to wgpu-matrix", () => {
    const out = new Float32Array(4);

    expect(quatFromAxisAngle([0, 0, 2], Math.PI / 2, out)).toBe(out);
    expectQuat(out, wgpuQuat.fromAxisAngle([0, 0, 1], Math.PI / 2));

    expectQuat(quatFromAxisAngle([0, 0, 0], Math.PI / 2, out), [0, 0, 0, 1]);
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

function expectQuat(actual: QuatLike, expected: QuatLike): void {
  for (let index = 0; index < 4; index += 1) {
    expect(read(actual, index)).toBeCloseTo(read(expected, index), CLOSE_TO);
  }
}

function expectEquivalentQuat(
  actual: QuatLike | undefined,
  expected: QuatLike,
): void {
  expect(actual).toBeDefined();

  if (actual === undefined) {
    return;
  }

  const dot =
    read(actual, 0) * read(expected, 0) +
    read(actual, 1) * read(expected, 1) +
    read(actual, 2) * read(expected, 2) +
    read(actual, 3) * read(expected, 3);
  expect(Math.abs(dot)).toBeCloseTo(1, CLOSE_TO);
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}.`);
  }

  return value;
}
