import type { Aabb, Mat4Like } from "./types.js";
export declare function unionAabb(a: Aabb, b: Aabb): Aabb;
/**
 * Largest scale factor the matrix applies along any basis axis. Multiplying a
 * bounding-sphere radius by this keeps the sphere conservative under rotation
 * and non-uniform scale (matches three.js `Matrix4.getMaxScaleOnAxis`).
 */
export declare function maxScaleOnAxis(matrix: Mat4Like): number;
export declare function transformAabb(aabb: Aabb, matrix: Mat4Like): Aabb;
//# sourceMappingURL=bounds.d.ts.map