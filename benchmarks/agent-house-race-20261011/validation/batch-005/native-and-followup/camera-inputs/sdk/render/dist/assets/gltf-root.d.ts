export type GltfRootValidationDiagnosticSeverity = "error" | "warning";
export type GltfRootValidationDiagnosticCode = "gltfRoot.malformedRoot" | "gltfRoot.invalidAsset" | "gltfRoot.unsupportedVersion" | "gltfRoot.malformedArray" | "gltfRoot.unsupportedRequiredExtension";
export type GltfRootDiagnosticValue = string | number | boolean | null;
export interface GltfRootValidationDiagnostic {
    readonly code: GltfRootValidationDiagnosticCode;
    readonly severity: GltfRootValidationDiagnosticSeverity;
    readonly message: string;
    readonly field?: string;
    readonly extensionName?: string;
    readonly value?: GltfRootDiagnosticValue;
}
export interface GltfRootValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly GltfRootValidationDiagnostic[];
}
export type GltfRootValidationReportJsonValue = GltfRootValidationReport;
export declare function validateGltfRootForAssetMapping(root: unknown): GltfRootValidationReport;
export declare function gltfRootValidationReportToJsonValue(report: GltfRootValidationReport): GltfRootValidationReportJsonValue;
export declare function gltfRootValidationReportToJson(report: GltfRootValidationReport): string;
//# sourceMappingURL=gltf-root.d.ts.map