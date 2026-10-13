import type { GltfMeshPrimitiveIndexReference, GltfMeshPrimitiveMappingDiagnostic } from "./gltf-mesh-primitive-types.js";
export declare function mapGltfMeshPrimitiveIndexReference(input: {
    readonly root: Record<string, unknown>;
    readonly primitive: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveIndexReference | null;
//# sourceMappingURL=gltf-mesh-primitive-indices.d.ts.map