import type { MaterialAsset } from "./types.js";
export declare const UNLIT_MATERIAL_UNIFORM_FLOATS = 4;
export declare const UNLIT_MATERIAL_UNIFORM_LAYOUT: readonly ["baseColorFactor.r", "baseColorFactor.g", "baseColorFactor.b", "baseColorFactor.a"];
export type UnlitMaterialPackingDiagnosticCode = "materialPack.unsupportedMaterialKind" | "materialPack.missingTextureHandle" | "materialPack.missingSamplerHandle";
export interface UnlitMaterialPackingDiagnostic {
    readonly code: UnlitMaterialPackingDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface UnlitMaterialResourceDependencies {
    readonly baseColorTextureKey: string | null;
    readonly baseColorSamplerKey: string | null;
}
export interface PackedUnlitMaterial {
    readonly uniform: Float32Array;
    readonly uniformLayout: typeof UNLIT_MATERIAL_UNIFORM_LAYOUT;
    readonly dependencies: UnlitMaterialResourceDependencies;
}
export interface PackUnlitMaterialResult {
    readonly valid: boolean;
    readonly packed: PackedUnlitMaterial | null;
    readonly diagnostics: readonly UnlitMaterialPackingDiagnostic[];
}
export declare function packUnlitMaterial(material: MaterialAsset): PackUnlitMaterialResult;
//# sourceMappingURL=unlit-packing.d.ts.map