import type { GltfMeshPrimitiveMappingDiagnostic } from "./gltf-mesh-primitive-types.js";
export interface GltfMeshPrimitiveReferenceResult {
    readonly primitive: Record<string, unknown> | null;
    readonly mesh: Record<string, unknown> | null;
    readonly fatal: boolean;
}
export declare function resolveGltfMeshPrimitiveReference(input: {
    readonly meshes: readonly unknown[];
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveReferenceResult;
export declare function allGltfMeshPrimitiveSelections(meshes: readonly unknown[]): readonly {
    readonly meshIndex: number;
    readonly primitiveIndex: number;
}[];
//# sourceMappingURL=gltf-mesh-primitive-selection.d.ts.map