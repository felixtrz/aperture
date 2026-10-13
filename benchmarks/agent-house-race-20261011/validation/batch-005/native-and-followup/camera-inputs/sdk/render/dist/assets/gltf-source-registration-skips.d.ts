import type { GltfMaterialTextureSlot } from "../materials/index.js";
import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfSkippedSourceAsset, GltfSourceAssetRegistrationDiagnostic, GltfSourceAssetRegistrationDiagnosticCode, GltfSourceAssetRegistrationKind } from "./gltf-source-registration-types.js";
export declare function skipAllGltfSourceAssetsForInvalidRoot(report: GltfAssetMappingReport, diagnostics: GltfSourceAssetRegistrationDiagnostic[], skipped: GltfSkippedSourceAsset[]): void;
export declare function skipDuplicateGltfSourceAsset(input: {
    readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
    readonly skipped: GltfSkippedSourceAsset[];
    readonly kind: GltfSourceAssetRegistrationKind;
    readonly plannedHandleKey: string;
    readonly registeredHandleKey: string;
    readonly materialIndex?: number;
    readonly textureIndex?: number;
    readonly slot?: GltfMaterialTextureSlot;
}): void;
export declare function skipGltfSourceAssetRegistration(input: {
    readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
    readonly skipped: GltfSkippedSourceAsset[];
    readonly entry: Omit<GltfSkippedSourceAsset, "diagnostics" | "reason"> & {
        readonly dependencyKey?: string;
    };
    readonly code: GltfSourceAssetRegistrationDiagnosticCode;
    readonly message: string;
}): void;
//# sourceMappingURL=gltf-source-registration-skips.d.ts.map