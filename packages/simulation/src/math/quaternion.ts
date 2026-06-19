import {
  quat as kquat,
  vec3 as kvec3,
  type RotationOrder as KernelRotationOrder,
} from "./kernel/index.js";
import { EPSILON } from "./constants.js";
import { quat } from "./constructors.js";
import { v3 } from "./scalars.js";
import type { Quat, QuatLike, Vec3, Vec3Like } from "./types.js";

export type EulerRotationOrder =
  | "XYZ"
  | "XZY"
  | "YXZ"
  | "YZX"
  | "ZXY"
  | "ZYX"
  | "xyz"
  | "xzy"
  | "yxz"
  | "yzx"
  | "zxy"
  | "zyx";

export function quatFromAxisAngle(
  axis: Vec3Like,
  radians: number,
  out: Quat = quat(),
): Quat {
  const axisLength = Math.hypot(v3(axis, 0), v3(axis, 1), v3(axis, 2));

  if (axisLength <= EPSILON) {
    return kquat.identity(out);
  }

  const inv = 1 / axisLength;
  return kquat.fromAxisAngle(
    [v3(axis, 0) * inv, v3(axis, 1) * inv, v3(axis, 2) * inv],
    radians,
    out,
  );
}

export function quatMultiply(
  a: QuatLike,
  b: QuatLike,
  out: Quat = quat(),
): Quat {
  const ax = q(a, 0);
  const ay = q(a, 1);
  const az = q(a, 2);
  const aw = q(a, 3);
  const bx = q(b, 0);
  const by = q(b, 1);
  const bz = q(b, 2);
  const bw = q(b, 3);

  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

export function quatNormalize(value: QuatLike, out: Quat = quat()): Quat {
  return kquat.normalize(value, out);
}

export function quatFromEuler(
  x: number,
  y: number,
  z: number,
  order: EulerRotationOrder = "YXZ",
  out: Quat = quat(),
): Quat {
  return kquat.fromEuler(x, y, z, toKernelRotationOrder(order), out);
}

export function quatFromEulerYXZ(
  x: number,
  y: number,
  z: number,
  out: Quat = quat(),
): Quat {
  const qy = quatFromAxisAngle([0, 1, 0], y);
  const qx = quatFromAxisAngle([1, 0, 0], x);
  const qz = quatFromAxisAngle([0, 0, 1], z);

  return quatNormalize(quatMultiply(quatMultiply(qy, qx), qz), out);
}

export function rotateVec3ByQuat(
  value: Vec3Like,
  rotation: QuatLike,
  out: Vec3 = kvec3.create(),
): Vec3 {
  return kvec3.transformQuat(value, rotation, out);
}

export function quatLookAt(
  eye: Vec3Like,
  target: Vec3Like,
  up: Vec3Like = [0, 1, 0],
  out: Quat = quat(),
): Quat {
  let zx = v3(eye, 0) - v3(target, 0);
  let zy = v3(eye, 1) - v3(target, 1);
  let zz = v3(eye, 2) - v3(target, 2);
  let zl = Math.hypot(zx, zy, zz);

  if (zl <= EPSILON) {
    return kquat.identity(out);
  }

  zx /= zl;
  zy /= zl;
  zz /= zl;

  let xx = v3(up, 1) * zz - v3(up, 2) * zy;
  let xy = v3(up, 2) * zx - v3(up, 0) * zz;
  let xz = v3(up, 0) * zy - v3(up, 1) * zx;
  let xl = Math.hypot(xx, xy, xz);

  if (xl <= EPSILON) {
    const fallback: Vec3Like = Math.abs(zx) > 0.9 ? [0, 0, 1] : [1, 0, 0];
    xx = v3(fallback, 1) * zz - v3(fallback, 2) * zy;
    xy = v3(fallback, 2) * zx - v3(fallback, 0) * zz;
    xz = v3(fallback, 0) * zy - v3(fallback, 1) * zx;
    xl = Math.hypot(xx, xy, xz) || 1;
  }

  xx /= xl;
  xy /= xl;
  xz /= xl;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return quatFromBasis(xx, xy, xz, yx, yy, yz, zx, zy, zz, out);
}

function toKernelRotationOrder(order: EulerRotationOrder): KernelRotationOrder {
  return order.toLowerCase() as KernelRotationOrder;
}

function q(values: QuatLike, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(
      `QuatLike is missing numeric value at index ${index}.`,
    );
  }

  return value;
}

function quatFromBasis(
  m00: number,
  m10: number,
  m20: number,
  m01: number,
  m11: number,
  m21: number,
  m02: number,
  m12: number,
  m22: number,
  out: Quat,
): Quat {
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    out[3] = 0.25 / s;
    out[0] = (m21 - m12) * s;
    out[1] = (m02 - m20) * s;
    out[2] = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    out[3] = (m21 - m12) / s;
    out[0] = 0.25 * s;
    out[1] = (m01 + m10) / s;
    out[2] = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    out[3] = (m02 - m20) / s;
    out[0] = (m01 + m10) / s;
    out[1] = 0.25 * s;
    out[2] = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    out[3] = (m10 - m01) / s;
    out[0] = (m02 + m20) / s;
    out[1] = (m12 + m21) / s;
    out[2] = 0.25 * s;
  }

  return quatNormalize(out, out);
}
