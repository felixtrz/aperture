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
  ColorTuple,
  Mat4,
  Mat4Like,
  Mat4Tuple,
  Quat,
  QuatTuple,
  TransformValues,
  Vec2,
  Vec2Tuple,
  Vec3,
  Vec3Tuple,
  Vec4,
  Vec4Tuple,
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

// Checked tuple constructors. TypeScript rejects a direct cast from
// `number[]` to a fixed-length tuple type (TS2352: "Target requires N
// element(s)"), which pushes callers toward `as unknown as` casts that skip
// length validation entirely. These converters are the sanctioned path from
// array-producing expressions (`.map()`, decoded JSON, GPU readbacks) into the
// `*Tuple` types: they validate the exact length at runtime and return a
// properly typed tuple.

export function vec2Tuple(values: ArrayLike<number>): Vec2Tuple {
  assertTupleLength(values, 2, "Vec2Tuple");
  return [read(values, 0, "Vec2Tuple"), read(values, 1, "Vec2Tuple")];
}

export function vec3Tuple(values: ArrayLike<number>): Vec3Tuple {
  assertTupleLength(values, 3, "Vec3Tuple");
  return [
    read(values, 0, "Vec3Tuple"),
    read(values, 1, "Vec3Tuple"),
    read(values, 2, "Vec3Tuple"),
  ];
}

export function vec4Tuple(values: ArrayLike<number>): Vec4Tuple {
  assertTupleLength(values, 4, "Vec4Tuple");
  return [
    read(values, 0, "Vec4Tuple"),
    read(values, 1, "Vec4Tuple"),
    read(values, 2, "Vec4Tuple"),
    read(values, 3, "Vec4Tuple"),
  ];
}

export function quatTuple(values: ArrayLike<number>): QuatTuple {
  assertTupleLength(values, 4, "QuatTuple");
  return [
    read(values, 0, "QuatTuple"),
    read(values, 1, "QuatTuple"),
    read(values, 2, "QuatTuple"),
    read(values, 3, "QuatTuple"),
  ];
}

export function colorTuple(values: ArrayLike<number>): ColorTuple {
  assertTupleLength(values, 4, "ColorTuple");
  return [
    read(values, 0, "ColorTuple"),
    read(values, 1, "ColorTuple"),
    read(values, 2, "ColorTuple"),
    read(values, 3, "ColorTuple"),
  ];
}

export function mat4Tuple(values: ArrayLike<number>): Mat4Tuple {
  assertTupleLength(values, 16, "Mat4Tuple");
  const out = new Array<number>(16);

  for (let index = 0; index < 16; index += 1) {
    out[index] = read(values, index, "Mat4Tuple");
  }

  return out as Mat4Tuple;
}

function assertTupleLength(
  values: ArrayLike<number>,
  expected: number,
  label: string,
): void {
  if (values.length !== expected) {
    throw new RangeError(
      `${label} requires exactly ${expected} element(s), received ${values.length}.`,
    );
  }
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
