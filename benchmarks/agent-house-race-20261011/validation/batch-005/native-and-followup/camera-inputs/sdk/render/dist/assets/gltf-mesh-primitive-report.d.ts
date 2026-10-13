import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";
import type { GltfMeshPrimitiveMappingDiagnostic, GltfMeshPrimitiveMappingReport, GltfMeshPrimitiveMappingReportJsonValue, GltfPlannedMeshPrimitiveAsset } from "./gltf-mesh-primitive-types.js";
export declare function gltfMeshPrimitiveMappingReportToJsonValue(report: GltfMeshPrimitiveMappingReport): GltfMeshPrimitiveMappingReportJsonValue;
export declare function gltfMeshPrimitiveMappingReportToJson(report: GltfMeshPrimitiveMappingReport): string;
export declare function createGltfMeshPrimitiveMappingReportResult(input: {
    readonly root: GltfRootValidationReportJsonValue;
    readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
    readonly meshes: readonly GltfPlannedMeshPrimitiveAsset[];
}): GltfMeshPrimitiveMappingReport;
//# sourceMappingURL=gltf-mesh-primitive-report.d.ts.map