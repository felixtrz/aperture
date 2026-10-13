import { type GltfAccessorDecodingReport } from "./gltf-accessor-decoding.js";
import { type GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import { type GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
import type { GltfAccessorValidationReport } from "./gltf-accessor-validation.js";
import type { GltfReportDrivenImportOptions } from "./gltf-report-driven-import-types.js";
export interface GltfReportDrivenMeshReports {
    readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
    readonly accessorValidation: GltfAccessorValidationReport;
    readonly accessorDecoding: GltfAccessorDecodingReport;
    readonly meshConstruction: GltfMeshAssetConstructionReport;
}
export declare function createGltfReportDrivenMeshReports(options: GltfReportDrivenImportOptions): GltfReportDrivenMeshReports;
//# sourceMappingURL=gltf-report-driven-import-meshes.d.ts.map