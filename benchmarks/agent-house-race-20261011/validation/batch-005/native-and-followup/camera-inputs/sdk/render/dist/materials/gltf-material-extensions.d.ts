import type { GltfMaterialMappingDiagnostic } from "./gltf-material-types.js";
export declare const CLEARCOAT_EXTENSION = "KHR_materials_clearcoat";
export declare const TRANSMISSION_EXTENSION = "KHR_materials_transmission";
export declare const SHEEN_EXTENSION = "KHR_materials_sheen";
export declare const IRIDESCENCE_EXTENSION = "KHR_materials_iridescence";
export declare const IOR_EXTENSION = "KHR_materials_ior";
export declare const VOLUME_EXTENSION = "KHR_materials_volume";
export declare function inspectUnsupportedClearcoatTextures(clearcoatSource: Record<string, unknown> | undefined, materialKey: string, diagnostics: GltfMaterialMappingDiagnostic[]): void;
export declare function inspectMaterialExtensions(input: {
    readonly materialKey: string;
    readonly extensions: Record<string, unknown> | undefined;
    readonly required: readonly string[];
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): void;
export declare function inspectUnsupportedUnlitFields(material: Record<string, unknown>, pbr: Record<string, unknown>, materialKey: string, diagnostics: GltfMaterialMappingDiagnostic[]): void;
//# sourceMappingURL=gltf-material-extensions.d.ts.map