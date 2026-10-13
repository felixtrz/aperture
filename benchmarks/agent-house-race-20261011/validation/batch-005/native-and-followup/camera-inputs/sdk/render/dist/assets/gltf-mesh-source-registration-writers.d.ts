import { type AssetRegistry } from "@aperture-engine/simulation";
import type { GltfMeshAssetConstructionReport, GltfPlannedMeshSourceAsset } from "./gltf-mesh-asset-construction.js";
import type { GltfMeshSourceAssetRegistrationDiagnostic, GltfRegisteredMeshSourceAsset, GltfSkippedMeshSourceAsset } from "./gltf-mesh-source-registration.js";
export declare function registerGltfPlannedMeshSourceAsset(input: {
    readonly registry: AssetRegistry;
    readonly report: GltfMeshAssetConstructionReport;
    readonly mesh: GltfPlannedMeshSourceAsset;
    readonly diagnostics: GltfMeshSourceAssetRegistrationDiagnostic[];
    readonly written: GltfRegisteredMeshSourceAsset[];
    readonly skipped: GltfSkippedMeshSourceAsset[];
}): void;
//# sourceMappingURL=gltf-mesh-source-registration-writers.d.ts.map