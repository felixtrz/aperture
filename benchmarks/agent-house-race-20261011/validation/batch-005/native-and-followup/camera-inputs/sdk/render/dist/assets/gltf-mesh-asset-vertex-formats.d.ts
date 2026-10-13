import type { GltfDecodedAccessor } from "./gltf-accessor-decoding.js";
import type { MeshVertexAttributeDescriptor } from "../mesh/index.js";
export declare function isSupportedMeshAttributeArray(decoded: GltfDecodedAccessor): boolean;
export declare function decodedAttributeByteSize(decoded: GltfDecodedAccessor): number;
export declare function decodedComponentByteSize(decoded: GltfDecodedAccessor): 1 | 2 | 4;
export declare function meshVertexFormatByteSize(format: MeshVertexAttributeDescriptor["format"]): number;
export declare function meshVertexFormatForDecodedAccessor(decoded: GltfDecodedAccessor): MeshVertexAttributeDescriptor["format"];
//# sourceMappingURL=gltf-mesh-asset-vertex-formats.d.ts.map