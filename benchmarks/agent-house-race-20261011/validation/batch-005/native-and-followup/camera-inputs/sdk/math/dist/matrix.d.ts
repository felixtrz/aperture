import type { Mat4, Mat4Like, QuatLike, TransformValues, Vec3, Vec3Like } from "./types.js";
export declare function composeTransform(out: Mat4, translation: Vec3Like, rotation: QuatLike, scale: Vec3Like): Mat4;
export declare function composeTrsMatrix(translation?: Vec3Like, rotation?: QuatLike, scale?: Vec3Like, out?: Mat4): Mat4;
export declare function multiplyMat4(a: Mat4Like, b: Mat4Like, out?: Mat4): Mat4;
export declare function decomposeTrsMatrix(matrix: Mat4Like): TransformValues | null;
/**
 * Returns a Float32 inverse, or null for non-finite inputs, numerically
 * unresolved determinants, Float32 output overflow, or an inverse
 * row/column that completely underflows to zero.
 * Singularity is tested relative to determinant terms after column scaling,
 * not against an absolute determinant cutoff. Resolvable near-singular inputs
 * may succeed; this is not a condition-number or Float32 accuracy guarantee.
 * On failure, `out` is unchanged. Input/output views may overlap.
 */
export declare function invertMat4(matrix: Mat4Like, out?: Mat4): Mat4 | null;
export declare function transformPoint(matrix: Mat4Like, point: Vec3Like, out?: Vec3): Vec3;
export declare function transformVector(matrix: Mat4Like, vector: Vec3Like, out?: Vec3): Vec3;
//# sourceMappingURL=matrix.d.ts.map