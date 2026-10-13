import type { PhysicsTransform } from "../backend.js";
import type { PhysicsVec3 } from "../components.js";
import { rotateVec3ByQuat } from "../math.js";

export { multiplyQuat, normalizeQuat, rotateVec3ByQuat } from "../math.js";

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
  const rotated = rotateVec3ByQuat(value, transform.rotation);

  return [rotated[0], rotated[1], rotated[2]];
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
