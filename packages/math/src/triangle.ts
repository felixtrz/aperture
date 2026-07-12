import { EPSILON } from "./constants.js";
import { vec3 } from "./constructors.js";
import { clamp01, v3 } from "./scalars.js";
import type { Vec3, Vec3Like } from "./types.js";

// Kernel-style triangle operations over array vectors (decision 0007: no math
// classes). Every function reads its inputs into scalar locals before writing
// the destination, so `out` may alias any input. Degenerate (zero-area)
// triangles are detected with a scale-invariant test — the squared parallelogram
// area `|ab x ac|^2` measured relative to `|ab|^2 * |ac|^2` (i.e. sin^2 of the
// corner angle) — so small-but-well-conditioned triangles (cm-authored content)
// are never misclassified the way an absolute area threshold would.

/**
 * Area of the triangle `(a, b, c)`: half the length of `(b - a) x (c - a)`.
 * Returns `0` for degenerate (collinear or coincident-vertex) triangles.
 */
export function triangleArea(a: Vec3Like, b: Vec3Like, c: Vec3Like): number {
  const abx = v3(b, 0) - v3(a, 0);
  const aby = v3(b, 1) - v3(a, 1);
  const abz = v3(b, 2) - v3(a, 2);
  const acx = v3(c, 0) - v3(a, 0);
  const acy = v3(c, 1) - v3(a, 1);
  const acz = v3(c, 2) - v3(a, 2);
  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;

  return 0.5 * Math.hypot(crossX, crossY, crossZ);
}

/**
 * Unit normal of the triangle `(a, b, c)` with counter-clockwise winding
 * (right-handed: the normal of `a=(0,0,0), b=(1,0,0), c=(0,1,0)` is `+Z`).
 * Degenerate triangles have no defined normal and yield the zero vector,
 * matching the kernel's `vec3.normalize` zero-input behavior.
 */
export function triangleNormal(
  a: Vec3Like,
  b: Vec3Like,
  c: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const abx = v3(b, 0) - v3(a, 0);
  const aby = v3(b, 1) - v3(a, 1);
  const abz = v3(b, 2) - v3(a, 2);
  const acx = v3(c, 0) - v3(a, 0);
  const acy = v3(c, 1) - v3(a, 1);
  const acz = v3(c, 2) - v3(a, 2);
  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;
  const lengthSq = crossX * crossX + crossY * crossY + crossZ * crossZ;
  const scale = lengthSq > 0 ? 1 / Math.sqrt(lengthSq) : 1;

  out[0] = crossX * scale;
  out[1] = crossY * scale;
  out[2] = crossZ * scale;
  return out;
}

/** Centroid (barycenter) of the triangle `(a, b, c)`: `(a + b + c) / 3`. */
export function triangleCentroid(
  a: Vec3Like,
  b: Vec3Like,
  c: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const x = (v3(a, 0) + v3(b, 0) + v3(c, 0)) / 3;
  const y = (v3(a, 1) + v3(b, 1) + v3(c, 1)) / 3;
  const z = (v3(a, 2) + v3(b, 2) + v3(c, 2)) / 3;

  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Barycentric coordinates `[u, v, w]` of `point` with respect to the triangle
 * `(a, b, c)`, such that `u + v + w = 1` and `u*a + v*b + w*c` is the
 * projection of `point` onto the triangle's plane (points off the plane are
 * implicitly projected). Returns `null` for degenerate triangles (the same
 * failure sentinel `decomposeTrsMatrix` uses); in that case `out` is left
 * untouched.
 */
export function triangleBarycentric(
  point: Vec3Like,
  a: Vec3Like,
  b: Vec3Like,
  c: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 | null {
  const abx = v3(b, 0) - v3(a, 0);
  const aby = v3(b, 1) - v3(a, 1);
  const abz = v3(b, 2) - v3(a, 2);
  const acx = v3(c, 0) - v3(a, 0);
  const acy = v3(c, 1) - v3(a, 1);
  const acz = v3(c, 2) - v3(a, 2);
  const apx = v3(point, 0) - v3(a, 0);
  const apy = v3(point, 1) - v3(a, 1);
  const apz = v3(point, 2) - v3(a, 2);

  const d00 = abx * abx + aby * aby + abz * abz;
  const d01 = abx * acx + aby * acy + abz * acz;
  const d11 = acx * acx + acy * acy + acz * acz;
  const d20 = apx * abx + apy * aby + apz * abz;
  const d21 = apx * acx + apy * acy + apz * acz;

  // denom = |ab x ac|^2; comparing it against EPSILON * |ab|^2 * |ac|^2 tests
  // sin^2 of the corner angle, which is scale-invariant and also catches
  // zero-length edges (where the right-hand side collapses to zero).
  const denom = d00 * d11 - d01 * d01;

  if (denom <= EPSILON * d00 * d11) {
    return null;
  }

  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;

  out[0] = 1 - v - w;
  out[1] = v;
  out[2] = w;
  return out;
}

/**
 * Closest point on the (solid) triangle `(a, b, c)` to `point`, via the
 * Ericson region test ("Real-Time Collision Detection", section 5.1.5): the
 * point is classified against the three vertex regions, three edge regions,
 * and the face interior, and the closest feature is returned without ever
 * dividing by a vanishing denominator. Degenerate triangles fall back to the
 * closest point on the three boundary segments, so the result is always
 * finite. Allocation-free when `out` is provided.
 */
export function triangleClosestPoint(
  point: Vec3Like,
  a: Vec3Like,
  b: Vec3Like,
  c: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const ax = v3(a, 0);
  const ay = v3(a, 1);
  const az = v3(a, 2);
  const bx = v3(b, 0);
  const by = v3(b, 1);
  const bz = v3(b, 2);
  const cx = v3(c, 0);
  const cy = v3(c, 1);
  const cz = v3(c, 2);
  const px = v3(point, 0);
  const py = v3(point, 1);
  const pz = v3(point, 2);

  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;

  // Degenerate triangles (zero area) have no interior; the closest point lies
  // on the boundary segments, which the scalar fallback scans directly.
  const d00 = abx * abx + aby * aby + abz * abz;
  const d01 = abx * acx + aby * acy + abz * acz;
  const d11 = acx * acx + acy * acy + acz * acz;

  if (d00 * d11 - d01 * d01 <= EPSILON * d00 * d11) {
    return closestPointOnBoundary(
      px,
      py,
      pz,
      ax,
      ay,
      az,
      bx,
      by,
      bz,
      cx,
      cy,
      cz,
      out,
    );
  }

  // Vertex region A.
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;

  if (d1 <= 0 && d2 <= 0) {
    out[0] = ax;
    out[1] = ay;
    out[2] = az;
    return out;
  }

  // Vertex region B.
  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;

  if (d3 >= 0 && d4 <= d3) {
    out[0] = bx;
    out[1] = by;
    out[2] = bz;
    return out;
  }

  // Edge region AB. `d1 - d3 = |ab|^2 > 0` for non-degenerate triangles.
  const vc = d1 * d4 - d3 * d2;

  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const t = d1 / (d1 - d3);
    out[0] = ax + abx * t;
    out[1] = ay + aby * t;
    out[2] = az + abz * t;
    return out;
  }

  // Vertex region C.
  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;

  if (d6 >= 0 && d5 <= d6) {
    out[0] = cx;
    out[1] = cy;
    out[2] = cz;
    return out;
  }

  // Edge region AC. `d2 - d6 = |ac|^2 > 0` for non-degenerate triangles.
  const vb = d5 * d2 - d1 * d6;

  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const t = d2 / (d2 - d6);
    out[0] = ax + acx * t;
    out[1] = ay + acy * t;
    out[2] = az + acz * t;
    return out;
  }

  // Edge region BC. `(d4 - d3) + (d5 - d6) = |bc|^2 > 0` for non-degenerate
  // triangles.
  const va = d3 * d6 - d5 * d4;

  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out[0] = bx + (cx - bx) * t;
    out[1] = by + (cy - by) * t;
    out[2] = bz + (cz - bz) * t;
    return out;
  }

  // Face interior: `va + vb + vc = |ab x ac|^2 > 0` for non-degenerate
  // triangles.
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;

  out[0] = ax + abx * v + acx * w;
  out[1] = ay + aby * v + acy * w;
  out[2] = az + abz * v + acz * w;
  return out;
}

/**
 * Whether `point` lies on the (solid) triangle `(a, b, c)`: within `epsilon`
 * of the triangle's plane (a real distance — the plane normal is normalized)
 * and inside or on the boundary by the coplanar barycentric test (each
 * coordinate `>= -epsilon`). Degenerate triangles contain no points and always
 * return `false`.
 */
export function triangleContainsPoint(
  point: Vec3Like,
  a: Vec3Like,
  b: Vec3Like,
  c: Vec3Like,
  epsilon: number = EPSILON,
): boolean {
  const abx = v3(b, 0) - v3(a, 0);
  const aby = v3(b, 1) - v3(a, 1);
  const abz = v3(b, 2) - v3(a, 2);
  const acx = v3(c, 0) - v3(a, 0);
  const acy = v3(c, 1) - v3(a, 1);
  const acz = v3(c, 2) - v3(a, 2);
  const apx = v3(point, 0) - v3(a, 0);
  const apy = v3(point, 1) - v3(a, 1);
  const apz = v3(point, 2) - v3(a, 2);

  const d00 = abx * abx + aby * aby + abz * abz;
  const d01 = abx * acx + aby * acy + abz * acz;
  const d11 = acx * acx + acy * acy + acz * acz;
  const denom = d00 * d11 - d01 * d01;

  if (denom <= EPSILON * d00 * d11) {
    return false;
  }

  // Distance from the plane, using the normalized normal so `epsilon` is a
  // world-space distance: |ap . (ab x ac)| / |ab x ac|, with |ab x ac| =
  // sqrt(denom).
  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;
  const planeDistance =
    Math.abs(apx * crossX + apy * crossY + apz * crossZ) / Math.sqrt(denom);

  if (planeDistance > epsilon) {
    return false;
  }

  const d20 = apx * abx + apy * aby + apz * abz;
  const d21 = apx * acx + apy * acy + apz * acz;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;

  return v >= -epsilon && w >= -epsilon && v + w <= 1 + epsilon;
}

// Scalar closest-point scan over the three boundary segments, used when the
// triangle is degenerate and the Ericson region denominators would vanish.
function closestPointOnBoundary(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  out: Vec3,
): Vec3 {
  let bestX = ax;
  let bestY = ay;
  let bestZ = az;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let edge = 0; edge < 3; edge += 1) {
    const sx = edge === 0 ? ax : edge === 1 ? bx : cx;
    const sy = edge === 0 ? ay : edge === 1 ? by : cy;
    const sz = edge === 0 ? az : edge === 1 ? bz : cz;
    const ex = edge === 0 ? bx : edge === 1 ? cx : ax;
    const ey = edge === 0 ? by : edge === 1 ? cy : ay;
    const ez = edge === 0 ? bz : edge === 1 ? cz : az;

    const dx = ex - sx;
    const dy = ey - sy;
    const dz = ez - sz;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    const t =
      lengthSq > 0
        ? clamp01(((px - sx) * dx + (py - sy) * dy + (pz - sz) * dz) / lengthSq)
        : 0;
    const candidateX = sx + dx * t;
    const candidateY = sy + dy * t;
    const candidateZ = sz + dz * t;
    const offsetX = px - candidateX;
    const offsetY = py - candidateY;
    const offsetZ = pz - candidateZ;
    const distanceSq =
      offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestX = candidateX;
      bestY = candidateY;
      bestZ = candidateZ;
    }
  }

  out[0] = bestX;
  out[1] = bestY;
  out[2] = bestZ;
  return out;
}
