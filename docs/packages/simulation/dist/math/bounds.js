import { vec3 as wgpuVec3 } from "wgpu-matrix";
import { vec3 } from "./constructors.js";
import { transformPoint } from "./matrix.js";
import { v3 } from "./scalars.js";
export function unionAabb(a, b) {
    return {
        min: wgpuVec3.min(asWgpuVec3Arg(a.min), asWgpuVec3Arg(b.min)),
        max: wgpuVec3.max(asWgpuVec3Arg(a.max), asWgpuVec3Arg(b.max)),
    };
}
/**
 * Largest scale factor the matrix applies along any basis axis. Multiplying a
 * bounding-sphere radius by this keeps the sphere conservative under rotation
 * and non-uniform scale (matches three.js `Matrix4.getMaxScaleOnAxis`).
 */
export function maxScaleOnAxis(matrix) {
    const m = matrix;
    const x = Number(m[0]) * Number(m[0]) +
        Number(m[1]) * Number(m[1]) +
        Number(m[2]) * Number(m[2]);
    const y = Number(m[4]) * Number(m[4]) +
        Number(m[5]) * Number(m[5]) +
        Number(m[6]) * Number(m[6]);
    const z = Number(m[8]) * Number(m[8]) +
        Number(m[9]) * Number(m[9]) +
        Number(m[10]) * Number(m[10]);
    return Math.sqrt(Math.max(x, y, z));
}
export function transformAabb(aabb, matrix) {
    const min = vec3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const max = vec3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
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
function asWgpuVec3Arg(value) {
    return value;
}
//# sourceMappingURL=bounds.js.map