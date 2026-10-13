import type { MeshVertexAttributeDescriptor } from "../mesh/index.js";
import type { GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-stream-types.js";
export declare function packVertexAttributes(vertexCount: number, sources: readonly GltfMeshAttributeSource[]): {
    readonly data: Float32Array | Uint16Array | Uint8Array;
    readonly descriptors: readonly MeshVertexAttributeDescriptor[];
    readonly strideBytes: number;
};
//# sourceMappingURL=gltf-mesh-asset-packed-streams.d.ts.map