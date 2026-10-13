import type { GltfMaterialMappingDiagnostic, GltfMaterialTextureSlot } from "./gltf-material-types.js";
export declare function mapTextureInfoSource(input: {
    readonly materialKey: string;
    readonly slot: GltfMaterialTextureSlot;
    readonly field: string;
    readonly value: unknown;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Record<string, unknown> | null;
export declare function mapTextureIndex(input: {
    readonly materialKey: string;
    readonly slot: GltfMaterialTextureSlot;
    readonly field: string;
    readonly value: Record<string, unknown>;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number | null;
export declare function mapTextureTexCoord(input: {
    readonly materialKey: string;
    readonly slot: GltfMaterialTextureSlot;
    readonly field: string;
    readonly value: Record<string, unknown>;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number | null;
//# sourceMappingURL=gltf-material-texture-info.d.ts.map