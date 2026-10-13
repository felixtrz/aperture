import { type AssetRegistry } from "@aperture-engine/simulation";
import type { GltfPlannedMaterialAsset, GltfPlannedSamplerAsset, GltfPlannedTextureAsset } from "./gltf-asset-mapping.js";
import type { GltfRegisteredSourceAsset, GltfSkippedSourceAsset, GltfSourceAssetRegistrationDiagnostic } from "./gltf-source-registration-types.js";
export declare function registerGltfPlannedTextureAsset(input: {
    readonly registry: AssetRegistry;
    readonly texture: GltfPlannedTextureAsset;
    readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
    readonly written: GltfRegisteredSourceAsset[];
    readonly skipped: GltfSkippedSourceAsset[];
}): void;
export declare function registerGltfPlannedSamplerAsset(input: {
    readonly registry: AssetRegistry;
    readonly sampler: GltfPlannedSamplerAsset;
    readonly texture: GltfPlannedTextureAsset | undefined;
    readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
    readonly written: GltfRegisteredSourceAsset[];
    readonly skipped: GltfSkippedSourceAsset[];
}): void;
export declare function registerGltfPlannedMaterialAsset(input: {
    readonly registry: AssetRegistry;
    readonly material: GltfPlannedMaterialAsset;
    readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
    readonly written: GltfRegisteredSourceAsset[];
    readonly skipped: GltfSkippedSourceAsset[];
}): void;
//# sourceMappingURL=gltf-source-registration-writers.d.ts.map