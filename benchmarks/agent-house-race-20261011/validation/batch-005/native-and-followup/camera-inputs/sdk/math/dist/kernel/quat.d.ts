import type { NumArray, Quat } from "./types.js";
export declare function create(x?: number, y?: number, z?: number, w?: number): Quat;
export declare function identity(dst?: Float32Array): Quat;
export declare function copy(qIn: NumArray, dst?: Float32Array): Quat;
export { copy as clone };
/** Quaternion product a * b. */
export declare function multiply(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Quat;
export { multiply as mul };
/** Builds a quaternion from a (assumed normalized) axis and angle in radians. */
export declare function fromAxisAngle(axisIn: NumArray, radians: number, dst?: Float32Array): Quat;
export type RotationOrder = "xyz" | "xzy" | "yxz" | "yzx" | "zxy" | "zyx";
/** Intrinsic Euler-angle to quaternion conversion in the given order. */
export declare function fromEuler(x: number, y: number, z: number, order: RotationOrder, dst?: Float32Array): Quat;
/**
 * Extracts a (non-normalized) quaternion from the rotation part of a
 * column-major matrix, via Shoemake's method — the exact algorithm the
 * previous backend used, so decomposition behaviour is unchanged.
 */
export declare function fromMat(mIn: NumArray, dst?: Float32Array): Quat;
export declare function dot(aIn: NumArray, bIn: NumArray): number;
export declare function length(vIn: NumArray): number;
export { length as len };
export declare function normalize(qIn: NumArray, dst?: Float32Array): Quat;
export declare function conjugate(qIn: NumArray, dst?: Float32Array): Quat;
/** Spherical linear interpolation between unit quaternions. */
export declare function slerp(aIn: NumArray, bIn: NumArray, t: number, dst?: Float32Array): Quat;
//# sourceMappingURL=quat.d.ts.map