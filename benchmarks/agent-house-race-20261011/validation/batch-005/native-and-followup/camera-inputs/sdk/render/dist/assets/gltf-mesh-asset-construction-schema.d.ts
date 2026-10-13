import type { MeshAsset, MeshVertexAttributeDescriptor } from "../mesh/index.js";
export declare function createGltfMeshSkinningSchema(descriptors: readonly MeshVertexAttributeDescriptor[]): NonNullable<MeshAsset["skinning"]> | null;
export declare function createGltfMeshMorphTargetDescriptors(descriptors: readonly MeshVertexAttributeDescriptor[]): NonNullable<MeshAsset["morphTargets"]>;
//# sourceMappingURL=gltf-mesh-asset-construction-schema.d.ts.map