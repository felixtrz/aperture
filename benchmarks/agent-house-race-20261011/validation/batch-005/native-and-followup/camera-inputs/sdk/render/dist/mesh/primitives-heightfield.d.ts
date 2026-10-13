import type { MeshAsset } from "./types.js";
import type { HeightfieldMeshOptions } from "./heightfield-types.js";
export { HeightfieldMeshError } from "./heightfield-validation.js";
/**
 * Build an open, Y-up surface with owned buffers and flat face normals. For
 * each cell (r, c), its diagonal joins (r, c) to (r+1, c+1). Triangles are
 * [(r,c), (r+1,c), (r+1,c+1)] and [(r,c), (r+1,c+1), (r,c+1)], facing +Y.
 * UVs are [column / (columns - 1), row / (rows - 1)]. Each triangle owns three
 * corners; there is no index buffer, smoothing, skirt, collider, or hidden RNG.
 */
export declare function createHeightfieldMeshAsset(options: HeightfieldMeshOptions): MeshAsset;
//# sourceMappingURL=primitives-heightfield.d.ts.map