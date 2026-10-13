import type { GltfMeshPrimitiveMappingDiagnostic, GltfMeshPrimitiveMappingOptions, GltfPlannedMeshPrimitiveAsset } from "./gltf-mesh-primitive-types.js";
export declare function planGltfMeshPrimitive(input: {
    readonly options: GltfMeshPrimitiveMappingOptions;
    readonly root: Record<string, unknown>;
    readonly mesh: Record<string, unknown> | null;
    readonly primitive: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfPlannedMeshPrimitiveAsset | null;
//# sourceMappingURL=gltf-mesh-primitive-planning.d.ts.map