import type { GltfMaterialMappingDiagnostic, GltfMaterialTextureBindingResolver } from "./gltf-material-types.js";
import type { StandardMaterialAsset } from "./types.js";
export interface GltfStandardMaterialFieldInput {
    readonly material: Record<string, unknown>;
    readonly pbrSource: Record<string, unknown>;
    readonly clearcoatSource?: Record<string, unknown> | undefined;
    readonly transmissionSource?: Record<string, unknown> | undefined;
    readonly sheenSource?: Record<string, unknown> | undefined;
    readonly iridescenceSource?: Record<string, unknown> | undefined;
    readonly iorSource?: Record<string, unknown> | undefined;
    readonly volumeSource?: Record<string, unknown> | undefined;
    readonly materialKey: string;
    readonly transmissionFactor: number;
    readonly resolver?: GltfMaterialTextureBindingResolver | undefined;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}
export declare function mapStandardPbrFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "baseColorFactor" | "baseColorTexture" | "metallicFactor" | "roughnessFactor" | "metallicRoughnessTexture">;
export declare function mapStandardSurfaceFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "normalTexture" | "normalScale" | "occlusionTexture" | "occlusionStrength" | "emissiveFactor" | "emissiveTexture">;
//# sourceMappingURL=gltf-material-standard-fields.d.ts.map