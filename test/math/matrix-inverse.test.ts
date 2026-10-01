import { describe, expect, it } from "vitest";
import { mat4 as glMat4 } from "gl-matrix";
import {
  composeTrsMatrix,
  identityMat4,
  invertMat4,
  mat4,
  multiplyMat4,
  quatFromAxisAngle,
  type Mat4,
  type Mat4Like,
} from "@aperture-engine/math";

// Dot products stay in double precision rather than rounding a product to f32
// before measuring it. The scaled residual allows for large translations and
// cancellation: |AB-I| / (|A||B| + |I|), checked in BOTH multiplication orders.
function expectInverseResidual(matrix: Mat4Like, inverse: Mat4Like): void {
  for (const [left, right] of [
    [matrix, inverse],
    [inverse, matrix],
  ]) {
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const identity = row === column ? 1 : 0;
        let product = 0;
        let magnitude = identity;
        for (let k = 0; k < 4; k += 1) {
          const term = left![k * 4 + row]! * right![column * 4 + k]!;
          product += term;
          magnitude += Math.abs(term);
        }
        expect(Math.abs(product - identity)).toBeLessThanOrEqual(
          2e-6 * magnitude + 1e-7,
        );
      }
    }
  }
}

function expectRelative(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    Math.abs(expected) * 2e-6 + 1e-44,
  );
}

function diagonal(x: number, y = x, z = x, w = 1): number[] {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, w];
}

function expectReference(matrix: Float32Array): void {
  const expected = glMat4.invert(new Float32Array(16), matrix);
  const actual = invertMat4(matrix);
  expect(expected).not.toBeNull();
  expect(actual).not.toBeNull();
  if (expected === null || actual === null) return;
  expect(Array.from(actual).every(Number.isFinite)).toBe(true);
  for (let index = 0; index < 16; index += 1) {
    // Near-zero cofactors can differ under normalization without harming the
    // inverse. Residuals provide the independent check, not just this oracle.
    expect(Math.abs(actual[index]! - expected[index]!)).toBeLessThanOrEqual(
      Math.max(Math.abs(expected[index]!) * 2e-5, 2e-6),
    );
  }
  expectInverseResidual(matrix, actual);
}

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("scale-aware matrix inversion", () => {
  it("inverts independent axes across Float32's usable scale range", () => {
    for (const scale of [
      1e-38, 1e-30, 1e-20, 1e-12, 1e-8, 1e-5, 1e-4, 0.001, 0.01, 1, 1e20, 1e38,
    ]) {
      for (const matrix of [
        diagonal(scale),
        diagonal(-scale, scale * 0.5, scale),
      ]) {
        const inverse = invertMat4(matrix);
        expect(inverse).not.toBeNull();
        if (inverse === null) continue;
        expectRelative(inverse[0], 1 / matrix[0]!);
        expectRelative(inverse[5], 1 / matrix[5]!);
        expectRelative(inverse[10], 1 / matrix[10]!);
        expect(inverse[15]).toBe(1);
        expectInverseResidual(matrix, inverse);
      }
    }
    const anisotropic = diagonal(1e-30, -1e30, 0.00001);
    expectInverseResidual(anisotropic, invertMat4(anisotropic)!);
  });

  it("retains subnormal Float32 outputs and allows negligible individual underflow", () => {
    const matrix = diagonal(1e40);
    const inverse = invertMat4(matrix);
    expect(inverse?.[0]).toBe(Math.fround(1e-40));
    expect(inverse?.[0]).toBeGreaterThan(0);
    const rotated = composeTrsMatrix(
      [0, 0, 0],
      quatFromAxisAngle([1, 0, 0], Math.PI),
      [1e30, 1e30, 1e30],
    );
    const rotatedInverse = invertMat4(rotated);
    expect(rotatedInverse).not.toBeNull();
    expectInverseResidual(rotated, rotatedInverse!);
  });

  it("keeps huge translations independent of the scale-aware singularity test", () => {
    const matrix = diagonal(1e-5);
    matrix[12] = 1e30;
    matrix[13] = -2e30;
    matrix[14] = 3e30;
    const inverse = invertMat4(matrix);
    expect(inverse).not.toBeNull();
    if (inverse === null) return;
    expectRelative(inverse[0], 1e5);
    expectRelative(inverse[12], -1e35);
    expectRelative(inverse[13], 2e35);
    expectRelative(inverse[14], -3e35);
    expectInverseResidual(matrix, inverse);
  });

  it("matches gl-matrix with independent residual checks for deterministic transforms", () => {
    const rng = random(59);
    for (let sample = 0; sample < 192; sample += 1) {
      const scale = 10 ** ((sample % 13) * 4 - 24);
      const matrix = composeTrsMatrix(
        [scale * (rng() - 0.5), scale * (rng() - 0.5), scale * (rng() - 0.5)],
        quatFromAxisAngle([rng(), rng(), rng()], rng() * Math.PI * 2),
        [
          scale * (0.5 + rng()),
          scale * (0.5 + rng()),
          scale * (rng() < 0.5 ? -1 : 1),
        ],
      );
      if (sample % 3 === 1) {
        const shear = identityMat4();
        shear[4] = 0.3;
        shear[8] = -0.2;
        shear[9] = 0.4;
        multiplyMat4(matrix, shear, matrix);
      }
      expectReference(matrix);
    }
  });

  it("inverts projective matrices and independently scaled dense columns", () => {
    const projection = glMat4.perspectiveZO(
      new Float32Array(16),
      1.1,
      1.6,
      0.01,
      10000,
    );
    expectReference(projection as Float32Array);
    const rng = random(59001);
    for (let sample = 0; sample < 128; sample += 1) {
      const matrix = identityMat4();
      for (let column = 0; column < 4; column += 1) {
        const scale = 10 ** (((sample + column * 7) % 15) * 4 - 28);
        for (let row = 0; row < 4; row += 1) {
          matrix[column * 4 + row] =
            scale * ((row === column ? 2 : 0) + (rng() - 0.5) * 0.25);
        }
      }
      expectReference(matrix);
    }
  });

  it("accepts resolvable near-singularity without an absolute determinant cutoff", () => {
    // An analytic inverse whose entries are all exactly representable in f32.
    const delta = 2 ** -20;
    const matrix = [1, 1, 0, 0, 1, 1 + delta, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const inverse = invertMat4(matrix);
    expect(inverse).not.toBeNull();
    expect(inverse?.[0]).toBe(1 / delta + 1);
    expect(inverse?.[1]).toBe(-1 / delta);
    expect(inverse?.[4]).toBe(-1 / delta);
    expect(inverse?.[5]).toBe(1 / delta);
    expectInverseResidual(matrix, inverse!);
  });

  it("rejects singularity, unresolved minor cancellation and unrepresentable outputs atomically", () => {
    const failures: Mat4Like[] = [
      diagonal(0),
      diagonal(0, 1, 1),
      diagonal(1, 0, 1),
      diagonal(1, 1, 0),
      diagonal(1, 1, 1, 0),
      diagonal(1e-39),
      diagonal(1e-100),
      diagonal(1e100),
      diagonal(1e308),
      // Output loses a row, while every output column still has a nonzero.
      [1e100, -1e100, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      // Cancellation is inside a 2x2 minor, not between the six final terms.
      [1, 1, 0, 0, 1, 1 + 2 ** -50, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      [1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      // General linear dependence with a nonzero column in every position.
      [1, 2, 3, 4, 5, 6, 7, 8, 6, 8, 10, 12, 1, -1, 2, -2],
      [1, 2, 3],
    ];
    const overflowingTranslation = diagonal(1e-5);
    overflowingTranslation[12] = 1e38;
    failures.push(overflowingTranslation);
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      for (let index = 0; index < 16; index += 1) {
        const matrix = diagonal(1);
        matrix[index] = value;
        failures.push(matrix);
      }
    }
    for (const matrix of failures) {
      const out = mat4();
      out.fill(17);
      expect(invertMat4(matrix, out)).toBeNull();
      expect(Array.from(out)).toEqual(Array<number>(16).fill(17));
      const alias = new Float32Array(matrix) as Mat4;
      const before = Array.from(alias);
      expect(invertMat4(alias, alias)).toBeNull();
      expect(Array.from(alias)).toEqual(before);
    }
  });

  it("rejects exactly dependent columns across deterministic changes of units", () => {
    const rng = random(59002);
    for (let sample = 0; sample < 128; sample += 1) {
      const matrix = Array<number>(16).fill(0);
      for (let row = 0; row < 4; row += 1) {
        matrix[row] = 1 + Math.floor(rng() * 8);
        matrix[4 + row] = 1 + Math.floor(rng() * 8);
        matrix[8 + row] = matrix[row]! + matrix[4 + row]!;
        matrix[12 + row] = 1 + Math.floor(rng() * 8);
      }
      for (let column = 0; column < 4; column += 1) {
        const scale = 2 ** (((sample + column * 5) % 11) * 20 - 100);
        for (let row = 0; row < 4; row += 1) matrix[column * 4 + row]! *= scale;
      }
      const out = mat4();
      out.fill(17);
      expect(invertMat4(matrix, out)).toBeNull();
      expect(Array.from(out)).toEqual(Array<number>(16).fill(17));
      const alias = new Float32Array(matrix) as Mat4;
      const before = Array.from(alias);
      expect(invertMat4(alias, alias)).toBeNull();
      expect(Array.from(alias)).toEqual(before);
    }
  });

  it("supports destination reuse, in-place inversion and overlapping views", () => {
    const matrix = composeTrsMatrix(
      [2e-5, -3e-5, 4e-5],
      quatFromAxisAngle([1, 2, 3], 0.8),
      [1e-5, 2e-5, -3e-5],
    );
    const expected = invertMat4(matrix)!;
    const out = mat4();
    expect(invertMat4(matrix, out)).toBe(out);
    expect(out).toEqual(expected);
    const inplace = new Float32Array(matrix) as Mat4;
    expect(invertMat4(inplace, inplace)).toBe(inplace);
    expect(inplace).toEqual(expected);
    const storage = new Float32Array(20);
    const input = storage.subarray(0, 16);
    const overlapping = storage.subarray(4, 20) as Mat4;
    input.set(matrix);
    expect(invertMat4(input, overlapping)).toBe(overlapping);
    expect(overlapping).toEqual(expected);
    input.set(diagonal(0));
    const before = Array.from(storage);
    expect(invertMat4(input, overlapping)).toBeNull();
    expect(Array.from(storage)).toEqual(before);
  });
});
