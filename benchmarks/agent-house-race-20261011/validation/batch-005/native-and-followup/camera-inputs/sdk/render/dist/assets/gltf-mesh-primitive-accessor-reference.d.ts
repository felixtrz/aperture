import type { GltfMeshPrimitiveAttributeReference, GltfMeshPrimitiveAttributeSemantic, GltfMeshPrimitiveMappingDiagnostic } from "./gltf-mesh-primitive-types.js";
export interface GltfMeshPrimitiveAccessorReferenceInput {
    readonly root: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}
export declare function mapGltfMeshPrimitiveAttributeReference(input: GltfMeshPrimitiveAccessorReferenceInput, attributes: Record<string, unknown>, semantic: GltfMeshPrimitiveAttributeSemantic): GltfMeshPrimitiveAttributeReference | null;
export declare function mapGltfMeshPrimitiveTargetAttributeReference(input: GltfMeshPrimitiveAccessorReferenceInput, target: Record<string, unknown>, targetSemantic: "POSITION" | "NORMAL", semantic: GltfMeshPrimitiveAttributeSemantic): GltfMeshPrimitiveAttributeReference | null;
export declare function validGltfAccessorReference(root: Record<string, unknown>, accessorIndex: unknown): accessorIndex is number;
//# sourceMappingURL=gltf-mesh-primitive-accessor-reference.d.ts.map