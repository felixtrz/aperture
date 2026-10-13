import type { GltfDecodedPrimitiveAccessors } from "./gltf-accessor-decoding.js";
import type { GltfMeshAssetConstructionDiagnostic } from "./gltf-mesh-asset-construction-types.js";
export declare function createGltfMeshAssetDiagnostic(primitive: GltfDecodedPrimitiveAccessors, code: string, input: Omit<GltfMeshAssetConstructionDiagnostic, "code" | "severity" | "meshHandleKey" | "meshIndex" | "primitiveIndex">): GltfMeshAssetConstructionDiagnostic;
export declare function gltfMeshAssetIdFromRegisteredHandleKey(handleKey: string): string;
export declare function gltfMeshPrimitiveRequestKey(meshIndex: number, primitiveIndex: number): string;
//# sourceMappingURL=gltf-mesh-asset-construction-diagnostics.d.ts.map