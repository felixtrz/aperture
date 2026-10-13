import type { AssetRegistry } from "@aperture-engine/simulation";
import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
import { type GltfMeshSourceAssetRegistrationReport, type GltfMeshSourceAssetRegistrationReportJsonValue } from "./gltf-mesh-source-registration.js";
import { type GltfSourceAssetRegistrationReport, type GltfSourceAssetRegistrationReportJsonValue } from "./gltf-source-registration.js";
export type GltfSourceRegistrationStage = "materialTextureSamplerRegistration" | "meshRegistration";
export type GltfSourceRegistrationStageStatus = "provided" | "missing" | "failed";
export type GltfSourceRegistrationOrchestrationDiagnosticCode = "gltfSourceRegistration.missingInput" | "gltfSourceRegistration.failedStage";
export interface GltfSourceRegistrationStageSummary {
    readonly stage: GltfSourceRegistrationStage;
    readonly status: GltfSourceRegistrationStageStatus;
    readonly writtenCount: number;
    readonly skippedCount: number;
    readonly diagnosticCount: number;
}
export interface GltfSourceRegistrationOrchestrationDiagnostic {
    readonly code: GltfSourceRegistrationOrchestrationDiagnosticCode;
    readonly severity: "error";
    readonly message: string;
    readonly stage?: GltfSourceRegistrationStage;
}
export interface GltfSourceRegistrationOrchestrationOptions {
    readonly registry: AssetRegistry;
    readonly assetMapping?: GltfAssetMappingReport;
    readonly meshConstruction?: GltfMeshAssetConstructionReport;
}
export interface GltfSourceRegistrationOrchestrationReport {
    readonly valid: boolean;
    readonly sourceRegistration: GltfSourceAssetRegistrationReport | null;
    readonly meshRegistration: GltfMeshSourceAssetRegistrationReport | null;
    readonly stages: readonly GltfSourceRegistrationStageSummary[];
    readonly diagnostics: readonly GltfSourceRegistrationOrchestrationDiagnostic[];
}
export interface GltfSourceRegistrationOrchestrationReportJsonValue extends Omit<GltfSourceRegistrationOrchestrationReport, "sourceRegistration" | "meshRegistration"> {
    readonly sourceRegistration: GltfSourceAssetRegistrationReportJsonValue | null;
    readonly meshRegistration: GltfMeshSourceAssetRegistrationReportJsonValue | null;
}
export declare function registerGltfSourceAssetsFromReports(options: GltfSourceRegistrationOrchestrationOptions): GltfSourceRegistrationOrchestrationReport;
export declare function gltfSourceRegistrationOrchestrationReportToJsonValue(report: GltfSourceRegistrationOrchestrationReport): GltfSourceRegistrationOrchestrationReportJsonValue;
export declare function gltfSourceRegistrationOrchestrationReportToJson(report: GltfSourceRegistrationOrchestrationReport): string;
//# sourceMappingURL=gltf-source-registration-orchestration.d.ts.map