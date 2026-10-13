import type { MeshAsset } from "./types.js";
import type { LatheMeshOptions } from "./lathe-types.js";
export { LatheMeshError } from "./lathe-validation.js";
/**
 * Revolve [radius, y] around Y: [r*cos(theta), y, r*sin(theta)], starting at +X
 * and turning toward +Z. For a=(i,j), b=(i+1,j), c=(i+1,j+1), d=(i,j+1),
 * emit [a,b,d], [d,b,c]. Ascending outer walls face out; descending inner
 * walls face in. Endpoint poles omit only their analytically collapsed face.
 * No automatic caps, implicit profile closure, or self-intersection repair.
 * Flat normals and owned buffers use the standard triangle-list layout.
 */
export declare function createLatheMeshAsset(options: LatheMeshOptions): MeshAsset;
//# sourceMappingURL=primitives-lathe.d.ts.map