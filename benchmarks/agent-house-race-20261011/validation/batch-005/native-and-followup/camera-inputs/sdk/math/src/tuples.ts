import { v3 } from "./scalars.js";
import type {
  Vec2Like,
  Vec2Tuple,
  Vec3Like,
  Vec3Tuple,
  Vec4Like,
  Vec4Tuple,
} from "./types.js";

// Canonical converters from any vector-like input to a plain, JSON-serializable
// tuple. These replace the many ad-hoc `tuple3` / `tuple4` helpers that used to
// live in the render, webgpu, and app layers — all math (including this kind of
// value reshaping) now flows through the math package.

export function toVec2Tuple(value: Vec2Like): Vec2Tuple {
  return [v2(value, 0), v2(value, 1)];
}

export function toVec3Tuple(value: Vec3Like): Vec3Tuple {
  return [v3(value, 0), v3(value, 1), v3(value, 2)];
}

export function toVec4Tuple(value: Vec4Like): Vec4Tuple {
  return [v4(value, 0), v4(value, 1), v4(value, 2), v4(value, 3)];
}

function v2(values: Vec2Like, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(
      `Vec2Like is missing numeric value at index ${index}.`,
    );
  }

  return value;
}

function v4(values: Vec4Like, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(
      `Vec4Like is missing numeric value at index ${index}.`,
    );
  }

  return value;
}
