import { vec3 } from "./constructors.js";
import { clamp01, v3 } from "./scalars.js";
import type { Vec3, Vec3Like } from "./types.js";

// Kernel-style line-segment operations over array vectors (decision 0007: no
// math classes). A segment is passed as its two endpoints `(start, end)`; the
// parameter `t` measures along the segment with `t = 0` at `start` and `t = 1`
// at `end`. Inputs are read into scalar locals before any write, so `out` may
// alias any input. Division guards are exact (`lengthSq === 0`), not
// epsilon-based, so short-but-valid segments keep their true closest points.

/** Segment delta `end - start`. */
export function lineDelta(
  start: Vec3Like,
  end: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const x = v3(end, 0) - v3(start, 0);
  const y = v3(end, 1) - v3(start, 1);
  const z = v3(end, 2) - v3(start, 2);

  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Parameter `t` in `[0, 1]` of the point on the segment `(start, end)`
 * closest to `point` (the projection of `point` onto the segment's line,
 * clamped to the segment). Zero-length segments yield `t = 0` (the start
 * point).
 */
export function lineClosestPointParameter(
  point: Vec3Like,
  start: Vec3Like,
  end: Vec3Like,
): number {
  const dx = v3(end, 0) - v3(start, 0);
  const dy = v3(end, 1) - v3(start, 1);
  const dz = v3(end, 2) - v3(start, 2);
  const lengthSq = dx * dx + dy * dy + dz * dz;

  if (lengthSq === 0) {
    return 0;
  }

  const px = v3(point, 0) - v3(start, 0);
  const py = v3(point, 1) - v3(start, 1);
  const pz = v3(point, 2) - v3(start, 2);

  return clamp01((px * dx + py * dy + pz * dz) / lengthSq);
}

/**
 * Closest point on the segment `(start, end)` to `point`, i.e. the segment
 * evaluated at `lineClosestPointParameter`. Zero-length segments yield
 * `start`.
 */
export function lineClosestPoint(
  point: Vec3Like,
  start: Vec3Like,
  end: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const sx = v3(start, 0);
  const sy = v3(start, 1);
  const sz = v3(start, 2);
  const t = lineClosestPointParameter(point, start, end);

  out[0] = sx + (v3(end, 0) - sx) * t;
  out[1] = sy + (v3(end, 1) - sy) * t;
  out[2] = sz + (v3(end, 2) - sz) * t;
  return out;
}

/**
 * Squared distance from `point` to the segment `(start, end)` (to its closest
 * point, not to the infinite line). Allocation-free.
 */
export function lineDistanceSq(
  point: Vec3Like,
  start: Vec3Like,
  end: Vec3Like,
): number {
  const sx = v3(start, 0);
  const sy = v3(start, 1);
  const sz = v3(start, 2);
  const t = lineClosestPointParameter(point, start, end);
  const dx = v3(point, 0) - (sx + (v3(end, 0) - sx) * t);
  const dy = v3(point, 1) - (sy + (v3(end, 1) - sy) * t);
  const dz = v3(point, 2) - (sz + (v3(end, 2) - sz) * t);

  return dx * dx + dy * dy + dz * dz;
}

/**
 * Closest pair of points between the segments `(p1, q1)` and `(p2, q2)`
 * (Ericson, "Real-Time Collision Detection", section 5.1.9) — the core query
 * behind capsule-capsule and capsule-segment tests. The closest point on
 * `(p1, q1)` is written to `outA`, the closest point on `(p2, q2)` to `outB`,
 * and the squared distance between them is returned. Zero-length segments
 * degrade gracefully to point-segment (or point-point) queries; parallel
 * overlapping segments return one valid pair among the infinitely many.
 * Allocation-free when both out-params are provided; `outA`/`outB` may alias
 * the inputs.
 */
export function segmentClosestPoints(
  p1: Vec3Like,
  q1: Vec3Like,
  p2: Vec3Like,
  q2: Vec3Like,
  outA: Vec3 = vec3(),
  outB: Vec3 = vec3(),
): number {
  const p1x = v3(p1, 0);
  const p1y = v3(p1, 1);
  const p1z = v3(p1, 2);
  const p2x = v3(p2, 0);
  const p2y = v3(p2, 1);
  const p2z = v3(p2, 2);

  // d1/d2 are the segment directions, r the offset between the start points.
  const d1x = v3(q1, 0) - p1x;
  const d1y = v3(q1, 1) - p1y;
  const d1z = v3(q1, 2) - p1z;
  const d2x = v3(q2, 0) - p2x;
  const d2y = v3(q2, 1) - p2y;
  const d2z = v3(q2, 2) - p2z;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const rz = p1z - p2z;

  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;

  let s: number;
  let t: number;

  if (a === 0 && e === 0) {
    // Both segments are points.
    s = 0;
    t = 0;
  } else if (a === 0) {
    // First segment is a point: project it onto the second segment.
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;

    if (e === 0) {
      // Second segment is a point: project it onto the first segment.
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;

      // denom = |d1 x d2|^2; zero means parallel lines, where any s works —
      // pick s = 0 and let the clamped re-projections below settle t.
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;

      // If t left [0, 1], clamp it and recompute s for the clamped t.
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const ax = p1x + d1x * s;
  const ay = p1y + d1y * s;
  const az = p1z + d1z * s;
  const bx = p2x + d2x * t;
  const by = p2y + d2y * t;
  const bz = p2z + d2z * t;

  outA[0] = ax;
  outA[1] = ay;
  outA[2] = az;
  outB[0] = bx;
  outB[1] = by;
  outB[2] = bz;

  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;

  return dx * dx + dy * dy + dz * dz;
}
