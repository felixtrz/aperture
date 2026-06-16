import { vec3 as wgpuVec3 } from "wgpu-matrix";

import { vec3 } from "./constructors.js";
import { v3 } from "./scalars.js";
import type { Vec3, Vec3Like } from "./types.js";

export function vec3Add(a: Vec3Like, b: Vec3Like, out: Vec3 = vec3()): Vec3 {
  out[0] = v3(a, 0) + v3(b, 0);
  out[1] = v3(a, 1) + v3(b, 1);
  out[2] = v3(a, 2) + v3(b, 2);
  return out;
}

export function vec3Subtract(
  a: Vec3Like,
  b: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  out[0] = v3(a, 0) - v3(b, 0);
  out[1] = v3(a, 1) - v3(b, 1);
  out[2] = v3(a, 2) - v3(b, 2);
  return out;
}

export function vec3Scale(
  value: Vec3Like,
  scale: number,
  out: Vec3 = vec3(),
): Vec3 {
  out[0] = v3(value, 0) * scale;
  out[1] = v3(value, 1) * scale;
  out[2] = v3(value, 2) * scale;
  return out;
}

export function vec3AddScaled(
  a: Vec3Like,
  b: Vec3Like,
  scale: number,
  out: Vec3 = vec3(),
): Vec3 {
  out[0] = v3(a, 0) + v3(b, 0) * scale;
  out[1] = v3(a, 1) + v3(b, 1) * scale;
  out[2] = v3(a, 2) + v3(b, 2) * scale;
  return out;
}

export function vec3Dot(a: Vec3Like, b: Vec3Like): number {
  return v3(a, 0) * v3(b, 0) + v3(a, 1) * v3(b, 1) + v3(a, 2) * v3(b, 2);
}

export function vec3Cross(a: Vec3Like, b: Vec3Like, out: Vec3 = vec3()): Vec3 {
  out[0] = v3(a, 1) * v3(b, 2) - v3(a, 2) * v3(b, 1);
  out[1] = v3(a, 2) * v3(b, 0) - v3(a, 0) * v3(b, 2);
  out[2] = v3(a, 0) * v3(b, 1) - v3(a, 1) * v3(b, 0);
  return out;
}

export function vec3Length(value: Vec3Like): number {
  return Math.hypot(v3(value, 0), v3(value, 1), v3(value, 2));
}

export function vec3LengthSq(value: Vec3Like): number {
  return vec3Dot(value, value);
}

export function vec3Distance(a: Vec3Like, b: Vec3Like): number {
  return Math.hypot(
    v3(a, 0) - v3(b, 0),
    v3(a, 1) - v3(b, 1),
    v3(a, 2) - v3(b, 2),
  );
}

export function vec3Normalize(value: Vec3Like, out: Vec3 = vec3()): Vec3 {
  return wgpuVec3.normalize(value, out);
}

export function vec3ProjectOnPlane(
  value: Vec3Like,
  normal: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const normalizedNormal = vec3Normalize(normal);
  return vec3AddScaled(
    value,
    normalizedNormal,
    -vec3Dot(value, normalizedNormal),
    out,
  );
}
