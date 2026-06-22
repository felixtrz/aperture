import {
  mat4 as kmat4,
  quat as kquat,
  vec2 as kvec2,
  vec3 as kvec3,
  vec4 as kvec4,
} from "./kernel/index.js";
import { read } from "./scalars.js";
import type {
  Color,
  Mat4,
  Mat4Like,
  Quat,
  TransformValues,
  Vec2,
  Vec3,
  Vec4,
} from "./types.js";

export function vec2(x = 0, y = 0): Vec2 {
  return kvec2.create(x, y);
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return kvec3.create(x, y, z);
}

export function vec4(x = 0, y = 0, z = 0, w = 0): Vec4 {
  return kvec4.create(x, y, z, w);
}

export function quat(x = 0, y = 0, z = 0, w = 1): Quat {
  return kquat.create(x, y, z, w);
}

export function color(r = 1, g = 1, b = 1, a = 1): Color {
  return vec4(r, g, b, a);
}

export function mat4(values?: Mat4Like): Mat4 {
  const out = kmat4.create();

  if (values === undefined) {
    return out;
  }

  for (let index = 0; index < 16; index += 1) {
    out[index] = read(values, index, "Mat4Like");
  }

  return out;
}

export function quatIdentity(): Quat {
  return kquat.identity();
}

export function identityMat4(out: Mat4 = mat4()): Mat4 {
  return kmat4.identity(out);
}

export function identityTransformValues(): TransformValues {
  return {
    translation: vec3(0, 0, 0),
    rotation: quatIdentity(),
    scale: vec3(1, 1, 1),
  };
}
