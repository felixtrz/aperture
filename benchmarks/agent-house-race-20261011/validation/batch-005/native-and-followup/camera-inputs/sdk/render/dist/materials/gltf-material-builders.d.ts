import type { GltfMaterialMappingDiagnostic, GltfMaterialTextureBindingResolver } from "./gltf-material-types.js";
import type { RenderStateDescriptor, StandardMaterialAsset, UnlitMaterialAsset } from "./types.js";
export declare function createUnlitGltfMaterialAsset(input: {
    readonly material: Record<string, unknown>;
    readonly pbrSource: Record<string, unknown>;
    readonly materialKey: string;
    readonly label: string;
    readonly renderState: RenderStateDescriptor;
    readonly resolver?: GltfMaterialTextureBindingResolver | undefined;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): UnlitMaterialAsset;
export declare function createStandardGltfMaterialAsset(input: {
    readonly material: Record<string, unknown>;
    readonly pbrSource: Record<string, unknown>;
    readonly clearcoatSource?: Record<string, unknown> | undefined;
    readonly transmissionSource?: Record<string, unknown> | undefined;
    readonly sheenSource?: Record<string, unknown> | undefined;
    readonly iridescenceSource?: Record<string, unknown> | undefined;
    readonly iorSource?: Record<string, unknown> | undefined;
    readonly volumeSource?: Record<string, unknown> | undefined;
    readonly materialKey: string;
    readonly label: string;
    readonly renderState: RenderStateDescriptor;
    readonly transmissionFactor: number;
    readonly resolver?: GltfMaterialTextureBindingResolver | undefined;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): StandardMaterialAsset;
//# sourceMappingURL=gltf-material-builders.d.ts.map