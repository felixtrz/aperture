// Aperture in-house quaternion kernel. Storage order is [x, y, z, w].

import { allocQuat } from "./alloc.js";
import type { NumArray, T4, T16, Quat } from "./types.js";

const EPSILON = 0.00001;

export function create(x = 0, y = 0, z = 0, w = 1): Quat {
  const d = allocQuat();
  d[0] = x;
  d[1] = y;
  d[2] = z;
  d[3] = w;
  return d;
}

export function identity(dst?: Float32Array): Quat {
  const d = allocQuat(dst);
  d[0] = 0;
  d[1] = 0;
  d[2] = 0;
  d[3] = 1;
  return d;
}

export function copy(qIn: NumArray, dst?: Float32Array): Quat {
  const q = qIn as unknown as T4;
  const d = allocQuat(dst);
  d[0] = q[0];
  d[1] = q[1];
  d[2] = q[2];
  d[3] = q[3];
  return d;
}

export { copy as clone };

/** Quaternion product a * b. */
export function multiply(
  aIn: NumArray,
  bIn: NumArray,
  dst?: Float32Array,
): Quat {
  const a = aIn as unknown as T4;
  const b = bIn as unknown as T4;
  const d = allocQuat(dst);
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];
  d[0] = ax * bw + aw * bx + ay * bz - az * by;
  d[1] = ay * bw + aw * by + az * bx - ax * bz;
  d[2] = az * bw + aw * bz + ax * by - ay * bx;
  d[3] = aw * bw - ax * bx - ay * by - az * bz;
  return d;
}

export { multiply as mul };

/** Builds a quaternion from a (assumed normalized) axis and angle in radians. */
export function fromAxisAngle(
  axisIn: NumArray,
  radians: number,
  dst?: Float32Array,
): Quat {
  const axis = axisIn as unknown as T4;
  const d = allocQuat(dst);
  const half = radians * 0.5;
  const s = Math.sin(half);
  d[0] = s * axis[0];
  d[1] = s * axis[1];
  d[2] = s * axis[2];
  d[3] = Math.cos(half);
  return d;
}

export type RotationOrder = "xyz" | "xzy" | "yxz" | "yzx" | "zxy" | "zyx";

/** Intrinsic Euler-angle to quaternion conversion in the given order. */
export function fromEuler(
  x: number,
  y: number,
  z: number,
  order: RotationOrder,
  dst?: Float32Array,
): Quat {
  const d = allocQuat(dst);
  const sx = Math.sin(x * 0.5);
  const cx = Math.cos(x * 0.5);
  const sy = Math.sin(y * 0.5);
  const cy = Math.cos(y * 0.5);
  const sz = Math.sin(z * 0.5);
  const cz = Math.cos(z * 0.5);
  switch (order) {
    case "xyz":
      d[0] = sx * cy * cz + cx * sy * sz;
      d[1] = cx * sy * cz - sx * cy * sz;
      d[2] = cx * cy * sz + sx * sy * cz;
      d[3] = cx * cy * cz - sx * sy * sz;
      break;
    case "xzy":
      d[0] = sx * cy * cz - cx * sy * sz;
      d[1] = cx * sy * cz - sx * cy * sz;
      d[2] = cx * cy * sz + sx * sy * cz;
      d[3] = cx * cy * cz + sx * sy * sz;
      break;
    case "yxz":
      d[0] = sx * cy * cz + cx * sy * sz;
      d[1] = cx * sy * cz - sx * cy * sz;
      d[2] = cx * cy * sz - sx * sy * cz;
      d[3] = cx * cy * cz + sx * sy * sz;
      break;
    case "yzx":
      d[0] = sx * cy * cz + cx * sy * sz;
      d[1] = cx * sy * cz + sx * cy * sz;
      d[2] = cx * cy * sz - sx * sy * cz;
      d[3] = cx * cy * cz - sx * sy * sz;
      break;
    case "zxy":
      d[0] = sx * cy * cz - cx * sy * sz;
      d[1] = cx * sy * cz + sx * cy * sz;
      d[2] = cx * cy * sz + sx * sy * cz;
      d[3] = cx * cy * cz - sx * sy * sz;
      break;
    case "zyx":
      d[0] = sx * cy * cz - cx * sy * sz;
      d[1] = cx * sy * cz + sx * cy * sz;
      d[2] = cx * cy * sz - sx * sy * cz;
      d[3] = cx * cy * cz + sx * sy * sz;
      break;
    default:
      throw new Error(`Unknown rotation order: ${String(order)}`);
  }
  return d;
}

/**
 * Extracts a (non-normalized) quaternion from the rotation part of a
 * column-major matrix, via Shoemake's method — the exact algorithm the
 * previous backend used, so decomposition behaviour is unchanged.
 */
export function fromMat(mIn: NumArray, dst?: Float32Array): Quat {
  const m = mIn as unknown as T16;
  const d = allocQuat(dst);
  const trace = m[0] + m[5] + m[10];
  if (trace > 0) {
    const root = Math.sqrt(trace + 1);
    d[3] = 0.5 * root;
    const invRoot = 0.5 / root;
    d[0] = (m[6] - m[9]) * invRoot;
    d[1] = (m[8] - m[2]) * invRoot;
    d[2] = (m[1] - m[4]) * invRoot;
  } else {
    let i = 0;
    if (m[5] > m[0]) {
      i = 1;
    }
    if (m[10] > m[i * 4 + i]!) {
      i = 2;
    }
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    const root = Math.sqrt(m[i * 4 + i]! - m[j * 4 + j]! - m[k * 4 + k]! + 1);
    d[i] = 0.5 * root;
    const invRoot = 0.5 / root;
    d[3] = (m[j * 4 + k]! - m[k * 4 + j]!) * invRoot;
    d[j] = (m[j * 4 + i]! + m[i * 4 + j]!) * invRoot;
    d[k] = (m[k * 4 + i]! + m[i * 4 + k]!) * invRoot;
  }
  return d;
}

export function dot(aIn: NumArray, bIn: NumArray): number {
  const a = aIn as unknown as T4;
  const b = bIn as unknown as T4;
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function length(vIn: NumArray): number {
  const v = vIn as unknown as T4;
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const w = v[3];
  return Math.sqrt(x * x + y * y + z * z + w * w);
}

export { length as len };

export function normalize(qIn: NumArray, dst?: Float32Array): Quat {
  const q = qIn as unknown as T4;
  const d = allocQuat(dst);
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const len = Math.sqrt(x * x + y * y + z * z + w * w);
  if (len > EPSILON) {
    const inv = 1 / len;
    d[0] = x * inv;
    d[1] = y * inv;
    d[2] = z * inv;
    d[3] = w * inv;
  } else {
    d[0] = 0;
    d[1] = 0;
    d[2] = 0;
    d[3] = 1;
  }
  return d;
}

export function conjugate(qIn: NumArray, dst?: Float32Array): Quat {
  const q = qIn as unknown as T4;
  const d = allocQuat(dst);
  d[0] = -q[0];
  d[1] = -q[1];
  d[2] = -q[2];
  d[3] = q[3];
  return d;
}

/** Spherical linear interpolation between unit quaternions. */
export function slerp(
  aIn: NumArray,
  bIn: NumArray,
  t: number,
  dst?: Float32Array,
): Quat {
  const a = aIn as unknown as T4;
  const b = bIn as unknown as T4;
  const d = allocQuat(dst);
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  let cosOmega = ax * bx + ay * by + az * bz + aw * bw;
  if (cosOmega < 0) {
    cosOmega = -cosOmega;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let scale0;
  let scale1;
  if (1 - cosOmega > EPSILON) {
    const omega = Math.acos(cosOmega);
    const sinOmega = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinOmega;
    scale1 = Math.sin(t * omega) / sinOmega;
  } else {
    scale0 = 1 - t;
    scale1 = t;
  }
  d[0] = scale0 * ax + scale1 * bx;
  d[1] = scale0 * ay + scale1 * by;
  d[2] = scale0 * az + scale1 * bz;
  d[3] = scale0 * aw + scale1 * bw;
  return d;
}
