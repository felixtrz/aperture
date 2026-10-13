// Storage allocation helpers. The branded vector/matrix types are
// `Float32Array & <tuple>`, which a bare `new Float32Array(n)` is not directly
// assignable to, so every allocation funnels through one of these. Each accepts
// the kernel's optional output-parameter `dst` (any same-shaped Float32Array)
// and returns it branded. The `as` conversions are type-only and free at
// runtime — these wrappers compile down to a plain `new Float32Array(n)` (or the
// passed-through `dst`) once V8 inlines them.

import type { Mat4, Quat, Vec2, Vec3, Vec4 } from "./types.js";

export function allocVec2(dst?: Float32Array): Vec2 {
  return (dst ?? new Float32Array(2)) as unknown as Vec2;
}

export function allocVec3(dst?: Float32Array): Vec3 {
  return (dst ?? new Float32Array(3)) as unknown as Vec3;
}

export function allocVec4(dst?: Float32Array): Vec4 {
  return (dst ?? new Float32Array(4)) as unknown as Vec4;
}

export function allocQuat(dst?: Float32Array): Quat {
  return (dst ?? new Float32Array(4)) as unknown as Quat;
}

export function allocMat4(dst?: Float32Array): Mat4 {
  return (dst ?? new Float32Array(16)) as unknown as Mat4;
}
