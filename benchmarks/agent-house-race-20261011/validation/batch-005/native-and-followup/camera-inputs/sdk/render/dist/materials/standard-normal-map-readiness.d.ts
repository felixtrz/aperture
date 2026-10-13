import type { MeshAsset, MeshVertexSemantic } from "../mesh/index.js";
import type { MaterialAsset } from "./types.js";
export type StandardMaterialNormalMapTangentDiagnosticCode = "standardNormalMap.unsupportedMaterialKind" | "standardNormalMap.missingTangents";
export interface StandardMaterialNormalMapTangentDiagnostic {
    readonly code: StandardMaterialNormalMapTangentDiagnosticCode;
    readonly message: string;
    readonly severity: "warning" | "error";
    readonly meshKey?: string;
    readonly materialKey?: string;
}
export interface StandardMaterialNormalMapTangentReadinessReport {
    readonly ready: boolean;
    readonly materialKind: MaterialAsset["kind"];
    readonly normalMapAuthored: boolean;
    readonly requiresTangents: boolean;
    readonly hasTangents: boolean;
    readonly meshSemantics: readonly MeshVertexSemantic[];
    readonly diagnostics: readonly StandardMaterialNormalMapTangentDiagnostic[];
}
export interface StandardMaterialNormalMapTangentReadinessOptions {
    readonly mesh: MeshAsset;
    readonly material: MaterialAsset;
    readonly meshKey?: string;
    readonly materialKey?: string;
}
export type StandardMaterialNormalMapTangentReadinessReportJsonValue = StandardMaterialNormalMapTangentReadinessReport;
export declare function createStandardMaterialNormalMapTangentReadinessReport(options: StandardMaterialNormalMapTangentReadinessOptions): StandardMaterialNormalMapTangentReadinessReport;
export declare function standardMaterialNormalMapTangentReadinessReportToJsonValue(report: StandardMaterialNormalMapTangentReadinessReport): StandardMaterialNormalMapTangentReadinessReportJsonValue;
export declare function standardMaterialNormalMapTangentReadinessReportToJson(report: StandardMaterialNormalMapTangentReadinessReport): string;
//# sourceMappingURL=standard-normal-map-readiness.d.ts.map