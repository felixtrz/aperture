import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
export interface GltfSourceAssetTransferPackage {
    readonly mainThread: {
        readonly assetMapping: GltfAssetMappingReport;
        readonly meshConstruction: GltfMeshAssetConstructionReport;
    };
    readonly extractionThread: {
        readonly assetMapping: GltfAssetMappingReport;
        readonly meshConstruction: GltfMeshAssetConstructionReport;
    };
    readonly transferList: readonly ArrayBuffer[];
    readonly transferredByteLength: number;
}
export declare function createGltfSourceAssetTransferPackage(input: {
    readonly assetMapping: GltfAssetMappingReport;
    readonly meshConstruction: GltfMeshAssetConstructionReport;
}): GltfSourceAssetTransferPackage;
//# sourceMappingURL=gltf-source-report-transfer.d.ts.map