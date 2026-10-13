import type { GltfMeshPrimitiveAttributeReferences, GltfMeshPrimitiveMappingDiagnostic } from "./gltf-mesh-primitive-types.js";
export { mapGltfMeshPrimitiveIndexReference } from "./gltf-mesh-primitive-indices.js";
export declare function mapGltfMeshPrimitiveAttributes(input: {
    readonly root: Record<string, unknown>;
    readonly primitive: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveAttributeReferences | null;
//# sourceMappingURL=gltf-mesh-primitive-attributes.d.ts.map