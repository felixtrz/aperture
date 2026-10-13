import { type AssetDiagnostic, type AssetHandle } from "@aperture-engine/simulation";
import type { MaterialAsset } from "../materials/index.js";
import type { GltfAssetMappingReport, GltfPlannedSamplerAsset, GltfPlannedTextureAsset } from "./gltf-asset-mapping.js";
export declare function gltfMaterialDependencyHandles(material: MaterialAsset): readonly AssetHandle[];
export declare function findGltfPlannedTextureForSampler(report: GltfAssetMappingReport, sampler: GltfPlannedSamplerAsset): GltfPlannedTextureAsset | undefined;
export declare function assetDiagnosticsFromGltfMappingDiagnostics(diagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: "error" | "warning";
}[]): readonly AssetDiagnostic[];
export declare function materialIdFromGltfPlannedHandleKey(handleKey: string): string;
//# sourceMappingURL=gltf-source-registration-dependencies.d.ts.map