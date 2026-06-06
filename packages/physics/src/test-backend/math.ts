import type { PhysicsTransform } from "../backend.js";
import type { PhysicsQuat, PhysicsVec3 } from "../components.js";

export function cloneVec3(values: PhysicsVec3): [number, number, number] {
  return [values[0], values[1], values[2]];
}

export function addScaled(
  a: PhysicsVec3,
  b: PhysicsVec3,
  scale: number,
): [number, number, number] {
  return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}

export function add(a: PhysicsVec3, b: PhysicsVec3): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(a: PhysicsVec3, value: number): [number, number, number] {
  return [a[0] * value, a[1] * value, a[2] * value];
}

export function subtract(
  a: PhysicsVec3,
  b: PhysicsVec3,
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function transformLocalPoint(
  transform: PhysicsTransform,
  point: PhysicsVec3,
): [number, number, number] {
  const rotated = transformLocalVector(transform, point);

  return [
    rotated[0] + transform.translation[0],
    rotated[1] + transform.translation[1],
    rotated[2] + transform.translation[2],
  ];
}

export function transformLocalVector(
  transform: PhysicsTransform,
  value: PhysicsVec3,
): [number, number, number] {
  return rotateVec3ByQuat(value, transform.rotation);
}

export function rotateVec3ByQuat(
  value: PhysicsVec3,
  rotation: PhysicsQuat,
): [number, number, number] {
  const qx = rotation[0];
  const qy = rotation[1];
  const qz = rotation[2];
  const qw = rotation[3];
  const x = value[0];
  const y = value[1];
  const z = value[2];
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export function normalizeQuat(value: PhysicsQuat): PhysicsQuat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);

  if (!Number.isFinite(length) || length === 0) {
    return [0, 0, 0, 1];
  }

  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
    value[3] / length,
  ];
}

export function multiplyQuat(
  left: PhysicsQuat,
  right: PhysicsQuat,
): PhysicsQuat {
  const leftNormalized = normalizeQuat(left);
  const rightNormalized = normalizeQuat(right);
  const lx = leftNormalized[0];
  const ly = leftNormalized[1];
  const lz = leftNormalized[2];
  const lw = leftNormalized[3];
  const rx = rightNormalized[0];
  const ry = rightNormalized[1];
  const rz = rightNormalized[2];
  const rw = rightNormalized[3];

  return normalizeQuat([
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ]);
}

export function dot(a: PhysicsVec3, b: PhysicsVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function distance(a: PhysicsVec3, b: PhysicsVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function normalize(value: PhysicsVec3): [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length === 0) {
    return [0, 1, 0];
  }
  return [value[0] / length, value[1] / length, value[2] / length];
}

export function finitePositive(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function finiteNonNegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
