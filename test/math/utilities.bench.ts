import { bench, describe } from "vitest";
import {
  easeInOutCubic,
  easeOutBounce,
  easeOutElastic,
  segmentClosestPoints,
  triangleArea,
  triangleBarycentric,
  triangleClosestPoint,
  vec3,
} from "@aperture-engine/math";

// Report-only benchmarks (no gating) for the G3 math utility round-out:
// triangle/segment queries and the easing pack. All calls use preallocated
// destinations, so we measure compute, not allocation, exactly as capsule
// tests and tween systems call them. Run with `pnpm run bench -- utilities`.

const BENCH = { time: 600, warmupTime: 150 } as const;

// Deterministic operand set: a mix of query points hitting the face interior,
// edge, and vertex regions of a fixed triangle.
const A = vec3(0, 0, 0);
const B = vec3(4, 0, 0);
const C = vec3(0, 4, 0);

const N = 1024;
const points = new Float32Array(N * 3);
{
  let s = 0x9e3779b9 >>> 0;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  for (let i = 0; i < N; i += 1) {
    points[i * 3] = rand() * 12 - 4;
    points[i * 3 + 1] = rand() * 12 - 4;
    points[i * 3 + 2] = rand() * 4 - 2;
  }
}

// Preallocated destinations and scratch views (reused every iteration).
const out = vec3();
const outB = vec3();
const point = vec3();
let sink = 0;

function loadPoint(i: number): void {
  point[0] = points[i * 3]!;
  point[1] = points[i * 3 + 1]!;
  point[2] = points[i * 3 + 2]!;
}

describe(`triangle queries (${N} mixed-region points)`, () => {
  bench(
    "triangleClosestPoint",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadPoint(i);
        triangleClosestPoint(point, A, B, C, out);
      }
      sink += out[0]!;
    },
    BENCH,
  );

  bench(
    "triangleBarycentric",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadPoint(i);
        triangleBarycentric(point, A, B, C, out);
      }
      sink += out[0]!;
    },
    BENCH,
  );

  bench(
    "triangleArea",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadPoint(i);
        sink += triangleArea(point, B, C);
      }
    },
    BENCH,
  );
});

describe(`segment-segment closest points (${N} pairs)`, () => {
  const q1 = vec3(1, 0.5, -0.25);
  const p2 = vec3(-2, 1, 1);
  const q2 = vec3(3, -1, 0.5);

  bench(
    "segmentClosestPoints",
    () => {
      for (let i = 0; i < N; i += 1) {
        loadPoint(i);
        sink += segmentClosestPoints(point, q1, p2, q2, out, outB);
      }
    },
    BENCH,
  );
});

describe(`easing (${N} evaluations per curve)`, () => {
  bench(
    "easeInOutCubic",
    () => {
      for (let i = 0; i < N; i += 1) {
        sink += easeInOutCubic(i / N);
      }
    },
    BENCH,
  );

  bench(
    "easeOutElastic",
    () => {
      for (let i = 0; i < N; i += 1) {
        sink += easeOutElastic(i / N);
      }
    },
    BENCH,
  );

  bench(
    "easeOutBounce",
    () => {
      for (let i = 0; i < N; i += 1) {
        sink += easeOutBounce(i / N);
      }
    },
    BENCH,
  );
});

// Keep `sink` observable so nothing is dead-code-eliminated.
export const __sink = () => sink + out[0]! + outB[0]!;
