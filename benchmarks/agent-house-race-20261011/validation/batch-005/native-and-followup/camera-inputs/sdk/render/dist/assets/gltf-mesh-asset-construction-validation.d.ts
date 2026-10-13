import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type { GltfDecodedAccessor, GltfDecodedPrimitiveAccessors } from "./gltf-accessor-decoding.js";
import type { MeshIndexBufferDescriptor } from "../mesh/index.js";
import type { GltfMeshAssetConstructionDiagnostic } from "./gltf-mesh-asset-construction-types.js";
export declare function createGltfMeshIndexBuffer(primitive: GltfDecodedPrimitiveAccessors, diagnostics: GltfMeshAssetConstructionDiagnostic[]): MeshIndexBufferDescriptor | null;
export declare function computeGltfMeshBounds(position: GltfDecodedAccessor, primitive: GltfDecodedPrimitiveAccessors, diagnostics: GltfMeshAssetConstructionDiagnostic[]): {
    readonly aabb: Aabb;
    readonly sphere: BoundingSphere;
} | null;
//# sourceMappingURL=gltf-mesh-asset-construction-validation.d.ts.map