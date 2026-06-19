import { bench, describe } from "vitest";
import {
  mat4 as wgpuMat4,
  quat as wgpuQuat,
  vec3 as wgpuVec3,
} from "wgpu-matrix";
import { mat4 as glMat4, quat as glQuat, vec3 as glVec3 } from "gl-matrix";
import { mat4, quat, vec3 } from "@aperture-engine/math/kernel";

// Concrete, reproducible benchmarks behind the "fastest 3D math for aperture's
// use case" claim. Each `describe` group races the aperture kernel against
// wgpu-matrix (the previous backend) and gl-matrix (the industry performance
// reference). Run with `pnpm run bench -- kernel`.
//
// Methodology notes:
//   - All competitors get preallocated output buffers, so we measure compute,
//     not allocation, exactly as the engine's hot paths call them.
//   - gl-matrix uses output-first argument order; wgpu-matrix and aperture use
//     output-last. The calls below respect each library's convention.
//   - Projection benchmarks use each library's WebGPU (z 0..1) variant.

const BENCH = { time: 600, warmupTime: 150 } as const;

// --- Shared operands (affine TRS matrices, unit quaternions, vectors) --------

const qa = quat.normalize(
  quat.fromAxisAngle(vec3.normalize([0.3, 0.7, -0.2]), 0.9),
);
const qb = quat.normalize(
  quat.fromAxisAngle(vec3.normalize([-0.5, 0.1, 0.85]), 2.1),
);
const ta = vec3.create(1.5, -2.25, 3.75);
const sa = vec3.create(1.25, 0.75, 2.0);
const tb = vec3.create(-4, 0.5, 1.0);
const sb = vec3.create(0.5, 1.5, 1.0);

const A = mat4.composeTRS(ta, qa, sa);
const B = mat4.composeTRS(tb, qb, sb);
const P = vec3.create(0.7, -1.3, 2.6);

// Preallocated destinations (reused every iteration).
const m4 = new Float32Array(16);
const v3 = new Float32Array(3);
const q4 = new Float32Array(4);
const sink = 0;

describe("mat4.multiply", () => {
  bench("aperture", () => void mat4.multiply(A, B, m4), BENCH);
  bench("wgpu-matrix", () => void wgpuMat4.multiply(A, B, m4), BENCH);
  bench("gl-matrix", () => void glMat4.multiply(m4, A, B), BENCH);
});

describe("mat4.inverse (general)", () => {
  bench("aperture", () => void mat4.inverse(A, m4), BENCH);
  bench("wgpu-matrix", () => void wgpuMat4.inverse(A, m4), BENCH);
  bench("gl-matrix", () => void glMat4.invert(m4, A), BENCH);
});

describe("compose TRS → mat4", () => {
  // aperture: single fused pass.
  bench(
    "aperture (fused composeTRS)",
    () => void mat4.composeTRS(ta, qa, sa, m4),
    BENCH,
  );
  // wgpu-matrix: the three-call sequence the fused op replaces.
  bench(
    "wgpu-matrix (fromQuat+scale+setTranslation)",
    () => {
      wgpuMat4.fromQuat(qa, m4);
      wgpuMat4.scale(m4, sa, m4);
      wgpuMat4.setTranslation(m4, ta, m4);
    },
    BENCH,
  );
  // gl-matrix: its dedicated fused helper.
  bench(
    "gl-matrix (fromRotationTranslationScale)",
    () => void glMat4.fromRotationTranslationScale(m4, qa, ta, sa),
    BENCH,
  );
});

describe("mat4 × vec3 (transform point)", () => {
  bench("aperture", () => void vec3.transformMat4(P, A, v3), BENCH);
  bench("wgpu-matrix", () => void wgpuVec3.transformMat4(P, A, v3), BENCH);
  bench("gl-matrix", () => void glVec3.transformMat4(v3, P, A), BENCH);
});

describe("quat.multiply", () => {
  bench("aperture", () => void quat.multiply(qa, qb, q4), BENCH);
  bench("wgpu-matrix", () => void wgpuQuat.multiply(qa, qb, q4), BENCH);
  bench("gl-matrix", () => void glQuat.multiply(q4, qa, qb), BENCH);
});

describe("quat.fromEuler", () => {
  bench(
    "aperture",
    () => void quat.fromEuler(0.3, -0.7, 1.1, "xyz", q4),
    BENCH,
  );
  bench(
    "wgpu-matrix",
    () => void wgpuQuat.fromEuler(0.3, -0.7, 1.1, "xyz", q4),
    BENCH,
  );
});

describe("perspective (WebGPU z 0..1)", () => {
  bench(
    "aperture",
    () => void mat4.perspective(1.2, 1.7778, 0.1, 1000, m4),
    BENCH,
  );
  bench(
    "wgpu-matrix",
    () => void wgpuMat4.perspective(1.2, 1.7778, 0.1, 1000, m4),
    BENCH,
  );
  bench(
    "gl-matrix (perspectiveZO)",
    () => void glMat4.perspectiveZO(m4, 1.2, 1.7778, 0.1, 1000),
    BENCH,
  );
});

describe("vec3.normalize", () => {
  bench("aperture", () => void vec3.normalize(P, v3), BENCH);
  bench("wgpu-matrix", () => void wgpuVec3.normalize(P, v3), BENCH);
  bench("gl-matrix", () => void glVec3.normalize(v3, P), BENCH);
});

// --- Aperture-specific fused fast paths (the use-case win) -------------------

describe("affine multiply: fused vs general", () => {
  bench(
    "aperture mulAffine (fast path)",
    () => void mat4.mulAffine(A, B, m4),
    BENCH,
  );
  bench(
    "aperture multiply (general)",
    () => void mat4.multiply(A, B, m4),
    BENCH,
  );
  bench("wgpu-matrix multiply", () => void wgpuMat4.multiply(A, B, m4), BENCH);
});

describe("affine inverse: fused vs general", () => {
  bench(
    "aperture invertAffine (fast path)",
    () => void mat4.invertAffine(A, m4),
    BENCH,
  );
  bench("aperture inverse (general)", () => void mat4.inverse(A, m4), BENCH);
  bench("wgpu-matrix inverse", () => void wgpuMat4.inverse(A, m4), BENCH);
});

// --- Macro: transform propagation over N entities ----------------------------
// The real engine workload: per entity, compose a local TRS matrix and combine
// it with a parent world matrix. Data lives in packed Float32Array SoA columns,
// updated in place with zero per-entity allocation.

const N = 4096;
const translations = new Float32Array(N * 3);
const rotations = new Float32Array(N * 4);
const scales = new Float32Array(N * 3);
const world = new Float32Array(N * 16);
const root = mat4.composeTRS([2, 0, -1], qa, [1, 1, 1]);

{
  // Seed deterministic per-entity transforms.
  let s = 0x12345 >>> 0;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  for (let i = 0; i < N; i += 1) {
    translations[i * 3] = rand() * 20 - 10;
    translations[i * 3 + 1] = rand() * 20 - 10;
    translations[i * 3 + 2] = rand() * 20 - 10;
    const q = quat.normalize(
      quat.fromAxisAngle(
        vec3.normalize([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]),
        rand() * 6.28,
      ),
    );
    rotations[i * 4] = q[0]!;
    rotations[i * 4 + 1] = q[1]!;
    rotations[i * 4 + 2] = q[2]!;
    rotations[i * 4 + 3] = q[3]!;
    scales[i * 3] = rand() * 2 + 0.25;
    scales[i * 3 + 1] = rand() * 2 + 0.25;
    scales[i * 3 + 2] = rand() * 2 + 0.25;
  }
}

// Scratch transform views (subarrays) reused across iterations.
const tScratch = new Float32Array(3);
const sScratch = new Float32Array(3);
const qScratch = new Float32Array(4);
const localScratch = new Float32Array(16);

function loadEntity(i: number): void {
  tScratch[0] = translations[i * 3]!;
  tScratch[1] = translations[i * 3 + 1]!;
  tScratch[2] = translations[i * 3 + 2]!;
  qScratch[0] = rotations[i * 4]!;
  qScratch[1] = rotations[i * 4 + 1]!;
  qScratch[2] = rotations[i * 4 + 2]!;
  qScratch[3] = rotations[i * 4 + 3]!;
  sScratch[0] = scales[i * 3]!;
  sScratch[1] = scales[i * 3 + 1]!;
  sScratch[2] = scales[i * 3 + 2]!;
}

describe(`transform propagation (${N} entities: compose TRS + parent multiply)`, () => {
  bench(
    "aperture (composeTRS + mulAffine)",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadEntity(i);
        mat4.composeTRS(tScratch, qScratch, sScratch, localScratch);
        mat4.mulAffine(root, localScratch, world.subarray(i * 16, i * 16 + 16));
      }
    },
    BENCH,
  );

  bench(
    "wgpu-matrix (fromQuat+scale+setTranslation + multiply)",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadEntity(i);
        wgpuMat4.fromQuat(qScratch, localScratch);
        wgpuMat4.scale(localScratch, sScratch, localScratch);
        wgpuMat4.setTranslation(localScratch, tScratch, localScratch);
        wgpuMat4.multiply(
          root,
          localScratch,
          world.subarray(i * 16, i * 16 + 16),
        );
      }
    },
    BENCH,
  );

  bench(
    "gl-matrix (fromRotationTranslationScale + multiply)",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadEntity(i);
        glMat4.fromRotationTranslationScale(
          localScratch,
          qScratch,
          tScratch,
          sScratch,
        );
        glMat4.multiply(
          world.subarray(i * 16, i * 16 + 16),
          root,
          localScratch,
        );
      }
    },
    BENCH,
  );
});

// Keep `sink` observable so nothing is dead-code-eliminated.
export const __sink = () => sink + m4[0]! + v3[0]! + q4[0]! + world[0]!;
