import type { MeshAsset } from "./types.js";
import type { ExtrudeMeshOptions } from "./extrude-types.js";
export { ExtrudeMeshError } from "./extrude-validation.js";
/**
 * Indexed closed XY polygon extruded along +Z. Caps have normals -Z/+Z;
 * walls have per-edge outward normals, with independent cap/wall vertices.
 * Cap UVs map the outline bounding box to [0,1]^2. Wall U is normalized
 * distance around each ring (seam at its lexicographically first point), V
 * is z/depth. Earcut triangulates caps only; no Three runtime is used.
 */
export declare function createExtrudeMeshAsset(options: ExtrudeMeshOptions): MeshAsset;
//# sourceMappingURL=primitives-extrude.d.ts.map