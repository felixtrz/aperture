import type { GltfDecodedAccessor } from "./gltf-accessor-decoding-types.js";
import type { GltfDecodedPrimitiveAccessors } from "./gltf-accessor-decoding-types.js";
/**
 * Synthesize per-vertex NORMAL data for a triangle primitive that has none.
 *
 * The glTF spec requires clients to compute normals when a mesh omits the
 * NORMAL attribute; without them a lit (non-unlit) material has nothing to
 * shade against and renders black. We accumulate area-weighted face normals
 * into each vertex (the un-normalized cross product is proportional to the
 * triangle area, so larger faces contribute more) and normalize, which yields
 * smooth normals on indexed geometry without changing the vertex count.
 *
 * Returns a decoded NORMAL accessor (float32x3, one per vertex) on success, or
 * null when the geometry is not a supported indexed/sequential float triangle
 * list — in which case the caller leaves the mesh normal-less, exactly as
 * before.
 */
export declare function generateMissingNormals(primitive: GltfDecodedPrimitiveAccessors, position: GltfDecodedAccessor): GltfDecodedAccessor | null;
//# sourceMappingURL=gltf-mesh-normals.d.ts.map