// Standalone, dependency-fair benchmark for the aperture math kernel.
//
// Unlike a vitest bench (which runs engine source through vite's module runner
// while node_modules deps load natively), this script imports the *built*
// kernel JS from dist and races it against wgpu-matrix and gl-matrix as equal,
// natively-loaded modules. Run after building simulation:
//
//   pnpm --filter @aperture-engine/simulation build && node scripts/bench-math.mjs
//
// Methodology: each op runs in a tight loop writing into a preallocated output
// (no per-iteration allocation), with warmup plus several timed trials; we
// report the median ops/sec and the winner per group.

import {
  mat4 as amat4,
  quat as aquat,
  vec3 as avec3,
} from "../packages/simulation/dist/math/kernel/index.js";
import {
  mat4 as wmat4,
  quat as wquat,
  vec3 as wvec3,
} from "wgpu-matrix";
import { mat4 as gmat4, quat as gquat, vec3 as gvec3 } from "gl-matrix";

const MICRO_ITERS = 2_000_000;
const TRIALS = 9;

function bench(fn, iters = MICRO_ITERS) {
  // Warmup to let the JIT specialize.
  for (let i = 0; i < Math.min(iters, 200_000); i += 1) fn(i);
  const samples = [];
  for (let t = 0; t < TRIALS; t += 1) {
    const start = performance.now();
    for (let i = 0; i < iters; i += 1) fn(i);
    const elapsed = performance.now() - start;
    samples.push(iters / (elapsed / 1000)); // ops/sec
  }
  samples.sort((a, b) => a - b);
  return samples[(samples.length - 1) >> 1]; // median
}

const groups = [];
function group(name, entries, iters) {
  const results = entries.map(([label, fn]) => ({
    label,
    hz: bench(fn, iters),
  }));
  results.sort((a, b) => b.hz - a.hz);
  groups.push({ name, results });
}

function fmt(hz) {
  return hz.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// --- Operands ---------------------------------------------------------------
const qa = aquat.normalize(
  aquat.fromAxisAngle(avec3.normalize([0.3, 0.7, -0.2]), 0.9),
);
const qb = aquat.normalize(
  aquat.fromAxisAngle(avec3.normalize([-0.5, 0.1, 0.85]), 2.1),
);
const ta = avec3.create(1.5, -2.25, 3.75);
const sa = avec3.create(1.25, 0.75, 2.0);
const tb = avec3.create(-4, 0.5, 1.0);
const sb = avec3.create(0.5, 1.5, 1.0);
const A = amat4.composeTRS(ta, qa, sa);
const B = amat4.composeTRS(tb, qb, sb);
const P = avec3.create(0.7, -1.3, 2.6);

const m4 = new Float32Array(16);
const v3 = new Float32Array(3);
const q4 = new Float32Array(4);

// --- Micro-ops --------------------------------------------------------------
group("mat4.multiply", [
  ["aperture", () => amat4.multiply(A, B, m4)],
  ["wgpu-matrix", () => wmat4.multiply(A, B, m4)],
  ["gl-matrix", () => gmat4.multiply(m4, A, B)],
]);

group("mat4.inverse (general)", [
  ["aperture", () => amat4.inverse(A, m4)],
  ["wgpu-matrix", () => wmat4.inverse(A, m4)],
  ["gl-matrix", () => gmat4.invert(m4, A)],
]);

group("compose TRS → mat4", [
  ["aperture (fused composeTRS)", () => amat4.composeTRS(ta, qa, sa, m4)],
  [
    "wgpu-matrix (fromQuat+scale+setTranslation)",
    () => {
      wmat4.fromQuat(qa, m4);
      wmat4.scale(m4, sa, m4);
      wmat4.setTranslation(m4, ta, m4);
    },
  ],
  [
    "gl-matrix (fromRotationTranslationScale)",
    () => gmat4.fromRotationTranslationScale(m4, qa, ta, sa),
  ],
]);

group("mat4 × vec3 (transform point)", [
  ["aperture", () => avec3.transformMat4(P, A, v3)],
  ["wgpu-matrix", () => wvec3.transformMat4(P, A, v3)],
  ["gl-matrix", () => gvec3.transformMat4(v3, P, A)],
]);

group("quat.multiply", [
  ["aperture", () => aquat.multiply(qa, qb, q4)],
  ["wgpu-matrix", () => wquat.multiply(qa, qb, q4)],
  ["gl-matrix", () => gquat.multiply(q4, qa, qb)],
]);

group("quat.fromEuler", [
  ["aperture", () => aquat.fromEuler(0.3, -0.7, 1.1, "xyz", q4)],
  ["wgpu-matrix", () => wquat.fromEuler(0.3, -0.7, 1.1, "xyz", q4)],
]);

group("perspective (WebGPU z 0..1)", [
  ["aperture", () => amat4.perspective(1.2, 1.7778, 0.1, 1000, m4)],
  ["wgpu-matrix", () => wmat4.perspective(1.2, 1.7778, 0.1, 1000, m4)],
  ["gl-matrix (perspectiveZO)", () => gmat4.perspectiveZO(m4, 1.2, 1.7778, 0.1, 1000)],
]);

group("vec3.normalize", [
  ["aperture", () => avec3.normalize(P, v3)],
  ["wgpu-matrix", () => wvec3.normalize(P, v3)],
  ["gl-matrix", () => gvec3.normalize(v3, P)],
]);

// --- Aperture fused fast paths ---------------------------------------------
group("affine multiply: fused vs general", [
  ["aperture mulAffine (fast path)", () => amat4.mulAffine(A, B, m4)],
  ["aperture multiply (general)", () => amat4.multiply(A, B, m4)],
  ["wgpu-matrix multiply", () => wmat4.multiply(A, B, m4)],
]);

group("affine inverse: fused vs general", [
  ["aperture invertAffine (fast path)", () => amat4.invertAffine(A, m4)],
  ["aperture inverse (general)", () => amat4.inverse(A, m4)],
  ["wgpu-matrix inverse", () => wmat4.inverse(A, m4)],
]);

// --- Macro: transform propagation over N entities ---------------------------
const N = 4096;
const translations = new Float32Array(N * 3);
const rotations = new Float32Array(N * 4);
const scales = new Float32Array(N * 3);
const world = new Float32Array(N * 16);
const root = amat4.composeTRS([2, 0, -1], qa, [1, 1, 1]);
{
  let s = 0x12345 >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  for (let i = 0; i < N; i += 1) {
    translations[i * 3] = rand() * 20 - 10;
    translations[i * 3 + 1] = rand() * 20 - 10;
    translations[i * 3 + 2] = rand() * 20 - 10;
    const q = aquat.normalize(
      aquat.fromAxisAngle(
        avec3.normalize([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]),
        rand() * 6.28,
      ),
    );
    rotations[i * 4] = q[0];
    rotations[i * 4 + 1] = q[1];
    rotations[i * 4 + 2] = q[2];
    rotations[i * 4 + 3] = q[3];
    scales[i * 3] = rand() * 2 + 0.25;
    scales[i * 3 + 1] = rand() * 2 + 0.25;
    scales[i * 3 + 2] = rand() * 2 + 0.25;
  }
}
const tS = new Float32Array(3);
const sS = new Float32Array(3);
const qS = new Float32Array(4);
const localS = new Float32Array(16);
function load(i) {
  tS[0] = translations[i * 3];
  tS[1] = translations[i * 3 + 1];
  tS[2] = translations[i * 3 + 2];
  qS[0] = rotations[i * 4];
  qS[1] = rotations[i * 4 + 1];
  qS[2] = rotations[i * 4 + 2];
  qS[3] = rotations[i * 4 + 3];
  sS[0] = scales[i * 3];
  sS[1] = scales[i * 3 + 1];
  sS[2] = scales[i * 3 + 2];
}
group(
  `transform propagation (${N} entities) — full sweeps/sec`,
  [
    [
      "aperture (composeTRS + mulAffine)",
      () => {
        for (let i = 0; i < N; i += 1) {
          load(i);
          amat4.composeTRS(tS, qS, sS, localS);
          amat4.mulAffine(root, localS, world.subarray(i * 16, i * 16 + 16));
        }
      },
    ],
    [
      "wgpu-matrix (fromQuat+scale+setTranslation + multiply)",
      () => {
        for (let i = 0; i < N; i += 1) {
          load(i);
          wmat4.fromQuat(qS, localS);
          wmat4.scale(localS, sS, localS);
          wmat4.setTranslation(localS, tS, localS);
          wmat4.multiply(root, localS, world.subarray(i * 16, i * 16 + 16));
        }
      },
    ],
    [
      "gl-matrix (fromRotationTranslationScale + multiply)",
      () => {
        for (let i = 0; i < N; i += 1) {
          load(i);
          gmat4.fromRotationTranslationScale(localS, qS, tS, sS);
          gmat4.multiply(world.subarray(i * 16, i * 16 + 16), root, localS);
        }
      },
    ],
  ],
  2_000,
);

// --- Report -----------------------------------------------------------------
const node = process.version;
console.log(`\nAperture math kernel benchmark  (Node ${node})`);
console.log("=".repeat(72));
for (const g of groups) {
  console.log(`\n${g.name}`);
  const best = g.results[0].hz;
  for (const r of g.results) {
    const rel = best / r.hz;
    const tag = r === g.results[0] ? "  ← fastest" : `  ${rel.toFixed(2)}× slower`;
    console.log(`  ${r.label.padEnd(46)} ${fmt(r.hz).padStart(14)} ops/s${tag}`);
  }
}
console.log("");
