import type { MeshAsset } from "./types.js";
import type { TriangleListMeshOptions } from "./triangle-list-types.js";
/** An invalid triangle-list input, with the offending field or face location. */
export declare class TriangleListMeshError extends RangeError {
    readonly path: string;
    constructor(path: string, reason: string);
}
/**
 * Construct a validated triangle-list asset using the standard POSITION,
 * NORMAL, TEXCOORD_0 layout. Zero-area faces after float32 conversion are
 * rejected rather than publishing NaN normals or silently removing faces.
 */
export declare function createTriangleListMeshAsset(options: TriangleListMeshOptions): MeshAsset;
//# sourceMappingURL=primitives-triangle-list.d.ts.map