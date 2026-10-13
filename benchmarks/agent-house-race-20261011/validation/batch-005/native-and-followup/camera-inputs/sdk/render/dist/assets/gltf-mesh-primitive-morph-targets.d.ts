import type { GltfMeshPrimitiveAttributeReference } from "./gltf-mesh-primitive-types.js";
import { type GltfMeshPrimitiveAccessorReferenceInput } from "./gltf-mesh-primitive-accessor-reference.js";
export interface GltfMeshPrimitiveMorphTargetAttributeReferences {
    readonly morphPosition0: GltfMeshPrimitiveAttributeReference | null;
    readonly morphNormal0: GltfMeshPrimitiveAttributeReference | null;
    readonly morphPosition1: GltfMeshPrimitiveAttributeReference | null;
    readonly morphNormal1: GltfMeshPrimitiveAttributeReference | null;
}
export declare function mapGltfMeshPrimitiveMorphTargetAttributeReferences(input: GltfMeshPrimitiveAccessorReferenceInput & {
    readonly primitive: Record<string, unknown>;
}): GltfMeshPrimitiveMorphTargetAttributeReferences;
//# sourceMappingURL=gltf-mesh-primitive-morph-targets.d.ts.map