// Aperture's in-house 3D math kernel: a zero-dependency, WebGPU-first,
// Float32Array-native replacement for the previous `wgpu-matrix` backend.
//
// The namespaces mirror the familiar `mat4.multiply(a, b, dst)` shape so the
// curated `math/` surface can call them exactly like the library it replaced,
// while owning every line — and adding fused, allocation-free fast paths
// (`mat4.composeTRS`, `mat4.mulAffine`, `mat4.invertAffine`) tuned for the
// engine's transform-propagation workload.

export * as vec2 from "./vec2.js";
export * as vec3 from "./vec3.js";
export * as vec4 from "./vec4.js";
export * as quat from "./quat.js";
export * as mat4 from "./mat4.js";

export type { Vec2, Vec3, Vec4, Quat, Mat4, NumArray } from "./types.js";
export type { RotationOrder } from "./quat.js";
