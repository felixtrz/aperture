import type { GltfRegisteredSourceAsset, GltfSkippedSourceAsset, GltfSourceAssetRegistrationDiagnostic, GltfSourceAssetRegistrationReport, GltfSourceAssetRegistrationReportJsonValue } from "./gltf-source-registration-types.js";
export declare function gltfSourceAssetRegistrationReportToJsonValue(report: GltfSourceAssetRegistrationReport): GltfSourceAssetRegistrationReportJsonValue;
export declare function gltfSourceAssetRegistrationReportToJson(report: GltfSourceAssetRegistrationReport): string;
export declare function createGltfSourceAssetRegistrationReport(input: {
    readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
    readonly written: readonly GltfRegisteredSourceAsset[];
    readonly skipped: readonly GltfSkippedSourceAsset[];
}): GltfSourceAssetRegistrationReport;
//# sourceMappingURL=gltf-source-registration-report.d.ts.map