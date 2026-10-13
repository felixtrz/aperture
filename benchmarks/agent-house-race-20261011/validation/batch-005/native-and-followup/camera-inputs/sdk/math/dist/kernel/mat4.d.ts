import type { Mat4, NumArray, Vec3 } from "./types.js";
export declare function create(): Mat4;
export declare function identity(dst?: Float32Array): Mat4;
export declare function copy(srcIn: NumArray, dst?: Float32Array): Mat4;
export { copy as clone };
/** Multiplies `a` (left) by `b` (right): dst = a * b. */
export declare function multiply(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Mat4;
export { multiply as mul };
/**
 * Multiplies two affine matrices (bottom row [0,0,0,1]): dst = a * b.
 * Skips the eight multiply-adds the general path spends on the homogeneous
 * row, so transform-hierarchy propagation runs measurably faster. The result
 * is identical to {@link multiply} whenever both inputs are affine.
 */
export declare function mulAffine(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Mat4;
/** Determinant of a 4x4 matrix. */
export declare function determinant(mIn: NumArray): number;
/**
 * Full inverse of a 4x4 matrix, via the 2x2-cofactor (Laplace) expansion — the
 * fastest known general scheme, with shared sub-determinants. A singular matrix
 * yields a non-finite result (`1/0`); callers that care guard with
 * {@link determinant} first. For affine transforms prefer {@link invertAffine}.
 */
export declare function inverse(mIn: NumArray, dst?: Float32Array): Mat4;
export { inverse as invert };
/**
 * Inverse of an affine matrix (bottom row [0,0,0,1]). Inverts the upper 3x3
 * linear part and re-derives the translation, which is far cheaper than the
 * general cofactor expansion. Returns `null` when the linear part is singular.
 */
export declare function invertAffine(mIn: NumArray, dst?: Float32Array): Mat4 | null;
/** Builds a rotation matrix from a quaternion [x, y, z, w]. */
export declare function fromQuat(qIn: NumArray, dst?: Float32Array): Mat4;
/** Scales the columns of `m` by `v`: dst = m * scale(v). */
export declare function scale(mIn: NumArray, vIn: NumArray, dst?: Float32Array): Mat4;
/** Sets the translation column of `m`. */
export declare function setTranslation(mIn: NumArray, vIn: NumArray, dst?: Float32Array): Mat4;
/** Reads the translation column into a vec3. */
export declare function getTranslation(mIn: NumArray, dst?: Float32Array): Vec3;
/**
 * Fused translation * rotation * scale composition. Equivalent to
 * `setTranslation(scale(fromQuat(q), s), t)` but computed in a single pass with
 * no intermediate matrices — the engine's per-entity transform hot path.
 */
export declare function composeTRS(tIn: NumArray, qIn: NumArray, sIn: NumArray, dst?: Float32Array): Mat4;
/**
 * WebGPU perspective projection (clip-space z in [0, 1]). Pass `Infinity` for
 * `zFar` to build an infinite-far projection.
 */
export declare function perspective(fovyRadians: number, aspect: number, zNear: number, zFar: number, dst?: Float32Array): Mat4;
/** WebGPU orthographic projection (clip-space z in [0, 1]). */
export declare function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, dst?: Float32Array): Mat4;
//# sourceMappingURL=mat4.d.ts.map