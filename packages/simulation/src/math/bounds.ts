import { vec3 as wgpuVec3, type Vec3Arg as WgpuVec3Arg } from "wgpu-matrix";

import { vec3 } from "./constructors.js";
import { transformPoint } from "./matrix.js";
import { v3 } from "./scalars.js";
import type { Aabb, Mat4Like } from "./types.js";

export function unionAabb(a: Aabb, b: Aabb): Aabb {
  return {
    min: wgpuVec3.min(asWgpuVec3Arg(a.min), asWgpuVec3Arg(b.min)),
    max: wgpuVec3.max(asWgpuVec3Arg(a.max), asWgpuVec3Arg(b.max)),
  };
}

export function transformAabb(aabb: Aabb, matrix: Mat4Like): Aabb {
  const min = vec3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  const max = vec3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  );
  const corner = vec3();
  const transformed = vec3();

  for (const x of [v3(aabb.min, 0), v3(aabb.max, 0)]) {
    for (const y of [v3(aabb.min, 1), v3(aabb.max, 1)]) {
      for (const z of [v3(aabb.min, 2), v3(aabb.max, 2)]) {
        corner[0] = x;
        corner[1] = y;
        corner[2] = z;
        transformPoint(matrix, corner, transformed);
        wgpuVec3.min(min, transformed, min);
        wgpuVec3.max(max, transformed, max);
      }
    }
  }

  return { min, max };
}

function asWgpuVec3Arg(value: Aabb["min"]): WgpuVec3Arg {
  return value as WgpuVec3Arg;
}
