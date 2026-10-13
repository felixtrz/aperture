import type { GltfCompressedMeshPrimitiveReference, GltfMeshPrimitiveAttributeReferences, GltfMeshPrimitiveMappingDiagnostic, GltfMeshPrimitiveMappingOptions } from "./gltf-mesh-primitive-types.js";
export declare function inspectUnsupportedCompression(input: {
    readonly options: GltfMeshPrimitiveMappingOptions;
    readonly primitive: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): void;
export declare function mapCompressedPrimitive(input: {
    readonly options: GltfMeshPrimitiveMappingOptions;
    readonly root: Record<string, unknown>;
    readonly primitive: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}, attributes: GltfMeshPrimitiveAttributeReferences): GltfCompressedMeshPrimitiveReference | null;
//# sourceMappingURL=gltf-mesh-primitive-compression.d.ts.map