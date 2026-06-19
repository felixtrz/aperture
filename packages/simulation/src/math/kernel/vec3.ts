// Aperture in-house vec3 kernel. Tight Float32Array storage, output-parameter
// style, monomorphic. Direct `v[0]` indexing (no polymorphic accessor) keeps
// these at the JIT ceiling. Inputs are cast to fixed tuples for precise typing
// under `noUncheckedIndexedAccess`; the casts are type-only and free at runtime.

import type { NumArray, T3, T4, T16, Vec3 } from "./types.js";

export function create(x = 0, y = 0, z = 0): Vec3 {
  const d = new Float32Array(3);
  d[0] = x;
  d[1] = y;
  d[2] = z;
  return d;
}

export function set(x: number, y: number, z: number, dst?: Vec3): Vec3 {
  const d = dst ?? new Float32Array(3);
  d[0] = x;
  d[1] = y;
  d[2] = z;
  return d;
}

export function copy(vIn: NumArray, dst?: Vec3): Vec3 {
  const v = vIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = v[0];
  d[1] = v[1];
  d[2] = v[2];
  return d;
}

export { copy as clone };

export function add(aIn: NumArray, bIn: NumArray, dst?: Vec3): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = a[0] + b[0];
  d[1] = a[1] + b[1];
  d[2] = a[2] + b[2];
  return d;
}

export function subtract(aIn: NumArray, bIn: NumArray, dst?: Vec3): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = a[0] - b[0];
  d[1] = a[1] - b[1];
  d[2] = a[2] - b[2];
  return d;
}

export { subtract as sub };

export function scale(vIn: NumArray, k: number, dst?: Vec3): Vec3 {
  const v = vIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = v[0] * k;
  d[1] = v[1] * k;
  d[2] = v[2] * k;
  return d;
}

export { scale as mulScalar };

export function addScaled(
  aIn: NumArray,
  bIn: NumArray,
  k: number,
  dst?: Vec3,
): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = a[0] + b[0] * k;
  d[1] = a[1] + b[1] * k;
  d[2] = a[2] + b[2] * k;
  return d;
}

export function negate(vIn: NumArray, dst?: Vec3): Vec3 {
  const v = vIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = -v[0];
  d[1] = -v[1];
  d[2] = -v[2];
  return d;
}

export function dot(aIn: NumArray, bIn: NumArray): number {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(aIn: NumArray, bIn: NumArray, dst?: Vec3): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  d[0] = ay * bz - az * by;
  d[1] = az * bx - ax * bz;
  d[2] = ax * by - ay * bx;
  return d;
}

export function lengthSq(vIn: NumArray): number {
  const v = vIn as unknown as T3;
  const x = v[0];
  const y = v[1];
  const z = v[2];
  return x * x + y * y + z * z;
}

export function length(v: NumArray): number {
  return Math.sqrt(lengthSq(v));
}

export { length as len };

export function distance(aIn: NumArray, bIn: NumArray): number {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalize(vIn: NumArray, dst?: Vec3): Vec3 {
  const v = vIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const lenSq = x * x + y * y + z * z;
  const s = lenSq > 0 ? 1 / Math.sqrt(lenSq) : 1;
  d[0] = x * s;
  d[1] = y * s;
  d[2] = z * s;
  return d;
}

export function min(aIn: NumArray, bIn: NumArray, dst?: Vec3): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = Math.min(a[0], b[0]);
  d[1] = Math.min(a[1], b[1]);
  d[2] = Math.min(a[2], b[2]);
  return d;
}

export function max(aIn: NumArray, bIn: NumArray, dst?: Vec3): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = Math.max(a[0], b[0]);
  d[1] = Math.max(a[1], b[1]);
  d[2] = Math.max(a[2], b[2]);
  return d;
}

export function lerp(
  aIn: NumArray,
  bIn: NumArray,
  t: number,
  dst?: Vec3,
): Vec3 {
  const a = aIn as unknown as T3;
  const b = bIn as unknown as T3;
  const d = dst ?? new Float32Array(3);
  d[0] = a[0] + t * (b[0] - a[0]);
  d[1] = a[1] + t * (b[1] - a[1]);
  d[2] = a[2] + t * (b[2] - a[2]);
  return d;
}

/** Full homogeneous transform of a point by a 4x4 matrix (divides by w). */
export function transformMat4(vIn: NumArray, mIn: NumArray, dst?: Vec3): Vec3 {
  const v = vIn as unknown as T3;
  const m = mIn as unknown as T16;
  const d = dst ?? new Float32Array(3);
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  d[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  d[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  d[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return d;
}

/** Transforms a direction by the upper 3x3 of a 4x4 matrix (ignores translation). */
export function transformMat4Upper3x3(
  vIn: NumArray,
  mIn: NumArray,
  dst?: Vec3,
): Vec3 {
  const v = vIn as unknown as T3;
  const m = mIn as unknown as T16;
  const d = dst ?? new Float32Array(3);
  const x = v[0];
  const y = v[1];
  const z = v[2];
  d[0] = x * m[0] + y * m[4] + z * m[8];
  d[1] = x * m[1] + y * m[5] + z * m[9];
  d[2] = x * m[2] + y * m[6] + z * m[10];
  return d;
}

/** Rotates a vec3 by a quaternion. */
export function transformQuat(vIn: NumArray, qIn: NumArray, dst?: Vec3): Vec3 {
  const v = vIn as unknown as T3;
  const q = qIn as unknown as T4;
  const d = dst ?? new Float32Array(3);
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const w2 = q[3] * 2;
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const uvX = qy * z - qz * y;
  const uvY = qz * x - qx * z;
  const uvZ = qx * y - qy * x;
  d[0] = x + uvX * w2 + (qy * uvZ - qz * uvY) * 2;
  d[1] = y + uvY * w2 + (qz * uvX - qx * uvZ) * 2;
  d[2] = z + uvZ * w2 + (qx * uvY - qy * uvX) * 2;
  return d;
}
