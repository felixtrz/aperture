import { describe, expect, it } from "vitest";
import {
  mat4 as wgpuMat4,
  quat as wgpuQuat,
  vec3 as wgpuVec3,
} from "wgpu-matrix";
import {
  mat4,
  quat,
  vec3,
  vec4,
} from "../../packages/simulation/src/math/kernel/index.js";

// Parity tolerance: kernel and wgpu-matrix both compute in f32, so results match
// to well within 5 decimal places. The fused ops are checked against the same
// composed primitives they replace.
const PLACES = 4;

function expectArrayClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual[i]).toBeCloseTo(expected[i]!, PLACES);
  }
}

// A deterministic pseudo-random generator so failures reproduce exactly.
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function randomQuat(rng: () => number): Float32Array {
  // Uniform-ish random rotation via axis-angle, then normalize.
  const q = quat.fromAxisAngle(
    vec3.normalize([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]),
    rng() * Math.PI * 2,
  );
  return quat.normalize(q);
}

function randomTRS(rng: () => number): {
  t: Float32Array;
  q: Float32Array;
  s: Float32Array;
} {
  return {
    t: vec3.create(rng() * 20 - 10, rng() * 20 - 10, rng() * 20 - 10),
    q: randomQuat(rng),
    // Keep scale away from zero so matrices stay invertible.
    s: vec3.create(rng() * 3 + 0.25, rng() * 3 + 0.25, rng() * 3 + 0.25),
  };
}

describe("math kernel — parity with wgpu-matrix", () => {
  const rng = makeRng(0x9e3779b9);

  it("mat4.multiply matches", () => {
    for (let i = 0; i < 64; i += 1) {
      const a = mat4.composeTRS(
        randomTRS(rng).t,
        randomTRS(rng).q,
        randomTRS(rng).s,
      );
      const trs = randomTRS(rng);
      const b = mat4.composeTRS(trs.t, trs.q, trs.s);
      expectArrayClose(mat4.multiply(a, b), wgpuMat4.multiply(a, b));
    }
  });

  it("mat4.inverse and determinant match", () => {
    for (let i = 0; i < 64; i += 1) {
      const trs = randomTRS(rng);
      const m = mat4.composeTRS(trs.t, trs.q, trs.s);
      expect(mat4.determinant(m)).toBeCloseTo(wgpuMat4.determinant(m), PLACES);
      expectArrayClose(mat4.inverse(m), wgpuMat4.inverse(m));
    }
  });

  it("mat4.fromQuat / scale / setTranslation match", () => {
    for (let i = 0; i < 32; i += 1) {
      const trs = randomTRS(rng);
      expectArrayClose(mat4.fromQuat(trs.q), wgpuMat4.fromQuat(trs.q));
      const r = mat4.fromQuat(trs.q);
      expectArrayClose(mat4.scale(r, trs.s), wgpuMat4.scale(r, trs.s));
      expectArrayClose(
        mat4.setTranslation(r, trs.t),
        wgpuMat4.setTranslation(r, trs.t),
      );
    }
  });

  it("mat4.perspective / ortho match (WebGPU clip space)", () => {
    expectArrayClose(
      mat4.perspective(Math.PI / 3, 16 / 9, 0.1, 100),
      wgpuMat4.perspective(Math.PI / 3, 16 / 9, 0.1, 100),
    );
    expectArrayClose(
      mat4.perspective(1.2, 1, 0.5, Infinity),
      wgpuMat4.perspective(1.2, 1, 0.5, Infinity),
    );
    expectArrayClose(
      mat4.ortho(-2, 6, -4, 8, 0.1, 100),
      wgpuMat4.ortho(-2, 6, -4, 8, 0.1, 100),
    );
  });

  it("quat.multiply / fromEuler / fromMat / slerp match", () => {
    for (let i = 0; i < 32; i += 1) {
      const a = randomQuat(rng);
      const b = randomQuat(rng);
      expectArrayClose(quat.multiply(a, b), wgpuQuat.multiply(a, b));
      const e = [rng() * 3 - 1.5, rng() * 3 - 1.5, rng() * 3 - 1.5] as const;
      expectArrayClose(
        quat.fromEuler(e[0], e[1], e[2], "xyz"),
        wgpuQuat.fromEuler(e[0], e[1], e[2], "xyz"),
      );
      const r = mat4.fromQuat(a);
      // fromMat is sign-ambiguous (q ≡ -q); compare as rotations via |dot|.
      const km = quat.normalize(quat.fromMat(r));
      const wm = wgpuQuat.normalize(wgpuQuat.fromMat(r));
      const d =
        km[0]! * wm[0]! + km[1]! * wm[1]! + km[2]! * wm[2]! + km[3]! * wm[3]!;
      expect(Math.abs(d)).toBeCloseTo(1, PLACES);
      expectArrayClose(quat.slerp(a, b, 0.37), wgpuQuat.slerp(a, b, 0.37));
    }
  });

  it("vec3 transforms match", () => {
    for (let i = 0; i < 32; i += 1) {
      const trs = randomTRS(rng);
      const m = mat4.composeTRS(trs.t, trs.q, trs.s);
      const v = vec3.create(rng() * 4 - 2, rng() * 4 - 2, rng() * 4 - 2);
      expectArrayClose(vec3.transformMat4(v, m), wgpuVec3.transformMat4(v, m));
      expectArrayClose(
        vec3.transformMat4Upper3x3(v, m),
        wgpuVec3.transformMat4Upper3x3(v, m),
      );
      expectArrayClose(
        vec3.transformQuat(v, trs.q),
        wgpuVec3.transformQuat(v, trs.q),
      );
      expectArrayClose(vec3.normalize(v), wgpuVec3.normalize(v));
    }
  });
});

describe("math kernel — fused fast paths", () => {
  const rng = makeRng(0x1234567);

  it("composeTRS equals the fromQuat→scale→setTranslation it replaces", () => {
    for (let i = 0; i < 64; i += 1) {
      const { t, q, s } = randomTRS(rng);
      const composed = wgpuMat4.fromQuat(q);
      wgpuMat4.scale(composed, s, composed);
      wgpuMat4.setTranslation(composed, t, composed);
      expectArrayClose(mat4.composeTRS(t, q, s), composed);
    }
  });

  it("mulAffine equals multiply for affine inputs", () => {
    for (let i = 0; i < 64; i += 1) {
      const a = randomTRS(rng);
      const b = randomTRS(rng);
      const ma = mat4.composeTRS(a.t, a.q, a.s);
      const mb = mat4.composeTRS(b.t, b.q, b.s);
      expectArrayClose(mat4.mulAffine(ma, mb), mat4.multiply(ma, mb));
    }
  });

  it("invertAffine equals inverse for affine inputs", () => {
    for (let i = 0; i < 64; i += 1) {
      const { t, q, s } = randomTRS(rng);
      const m = mat4.composeTRS(t, q, s);
      const inv = mat4.invertAffine(m);
      expect(inv).not.toBeNull();
      expectArrayClose(inv as Float32Array, mat4.inverse(m));
      // Round-trip: m * m⁻¹ ≈ identity.
      expectArrayClose(
        mat4.multiply(m, inv as Float32Array),
        mat4.identity(),
      );
    }
  });

  it("invertAffine returns null for a singular linear part", () => {
    const singular = mat4.composeTRS([1, 2, 3], [0, 0, 0, 1], [0, 1, 1]);
    expect(mat4.invertAffine(singular)).toBeNull();
  });

  it("vec4 helpers round-trip", () => {
    const v = vec4.create(1, 2, 3, 4);
    expect(vec4.dot(v, v)).toBeCloseTo(30, PLACES);
    expectArrayClose(vec4.add(v, v), [2, 4, 6, 8]);
  });
});
