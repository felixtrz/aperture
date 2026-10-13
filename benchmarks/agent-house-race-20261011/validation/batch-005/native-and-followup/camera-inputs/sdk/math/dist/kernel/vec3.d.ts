import type { NumArray, Vec3 } from "./types.js";
export declare function create(x?: number, y?: number, z?: number): Vec3;
export declare function set(x: number, y: number, z: number, dst?: Float32Array): Vec3;
export declare function copy(vIn: NumArray, dst?: Float32Array): Vec3;
export { copy as clone };
export declare function add(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec3;
export declare function subtract(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec3;
export { subtract as sub };
export declare function scale(vIn: NumArray, k: number, dst?: Float32Array): Vec3;
export { scale as mulScalar };
export declare function addScaled(aIn: NumArray, bIn: NumArray, k: number, dst?: Float32Array): Vec3;
export declare function negate(vIn: NumArray, dst?: Float32Array): Vec3;
export declare function dot(aIn: NumArray, bIn: NumArray): number;
export declare function cross(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec3;
export declare function lengthSq(vIn: NumArray): number;
export declare function length(v: NumArray): number;
export { length as len };
export declare function distance(aIn: NumArray, bIn: NumArray): number;
export declare function normalize(vIn: NumArray, dst?: Float32Array): Vec3;
export declare function min(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec3;
export declare function max(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec3;
export declare function lerp(aIn: NumArray, bIn: NumArray, t: number, dst?: Float32Array): Vec3;
/** Full homogeneous transform of a point by a 4x4 matrix (divides by w). */
export declare function transformMat4(vIn: NumArray, mIn: NumArray, dst?: Float32Array): Vec3;
/** Transforms a direction by the upper 3x3 of a 4x4 matrix (ignores translation). */
export declare function transformMat4Upper3x3(vIn: NumArray, mIn: NumArray, dst?: Float32Array): Vec3;
/** Rotates a vec3 by a quaternion. */
export declare function transformQuat(vIn: NumArray, qIn: NumArray, dst?: Float32Array): Vec3;
//# sourceMappingURL=vec3.d.ts.map