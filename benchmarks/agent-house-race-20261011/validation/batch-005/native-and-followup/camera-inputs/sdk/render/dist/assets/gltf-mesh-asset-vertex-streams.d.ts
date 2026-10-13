import type { MeshAsset } from "../mesh/index.js";
import type { GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-stream-types.js";
export type { GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-stream-types.js";
export { decodedAttributeByteSize, isSupportedMeshAttributeArray, } from "./gltf-mesh-asset-vertex-formats.js";
export declare function createVertexStreams(vertexCount: number, sources: readonly GltfMeshAttributeSource[]): MeshAsset["vertexStreams"];
//# sourceMappingURL=gltf-mesh-asset-vertex-streams.d.ts.map