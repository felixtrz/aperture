import type { GltfDecodedAccessor, GltfDecodedPrimitiveAccessors } from "./gltf-accessor-decoding.js";
import type { GltfMeshAssetConstructionDiagnostic, GltfMeshAssetTangentGenerationRequest } from "./gltf-mesh-asset-construction-types.js";
import { type GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-streams.js";
export declare function collectGltfMeshAttributeSources(primitive: GltfDecodedPrimitiveAccessors, position: GltfDecodedAccessor, diagnostics: GltfMeshAssetConstructionDiagnostic[], tangentRequest: GltfMeshAssetTangentGenerationRequest | undefined, generateNormals?: boolean): readonly GltfMeshAttributeSource[] | null;
//# sourceMappingURL=gltf-mesh-asset-construction-attributes.d.ts.map