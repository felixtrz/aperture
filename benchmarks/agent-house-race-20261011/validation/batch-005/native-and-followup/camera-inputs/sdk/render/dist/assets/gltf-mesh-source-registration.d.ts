import type { AssetDiagnostic, AssetRegistry } from "@aperture-engine/simulation";
import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
export type GltfMeshSourceAssetRegistrationKind = "mesh";
export type GltfMeshSourceAssetRegistrationDiagnosticSeverity = "error" | "warning";
export type GltfMeshSourceAssetRegistrationDiagnosticCode = "gltfMeshRegistration.invalidConstructionReport" | "gltfMeshRegistration.invalidPlannedAsset" | "gltfMeshRegistration.duplicateAssetKey" | "gltfMeshRegistration.invalidHandleKey";
export interface GltfMeshSourceAssetRegistrationDiagnostic {
    readonly code: GltfMeshSourceAssetRegistrationDiagnosticCode;
    readonly severity: GltfMeshSourceAssetRegistrationDiagnosticSeverity;
    readonly message: string;
    readonly kind?: GltfMeshSourceAssetRegistrationKind;
    readonly plannedHandleKey?: string;
    readonly registeredHandleKey?: string;
    readonly meshIndex?: number;
    readonly primitiveIndex?: number;
}
export interface GltfRegisteredMeshSourceAsset {
    readonly kind: GltfMeshSourceAssetRegistrationKind;
    readonly plannedHandleKey: string;
    readonly registeredHandleKey: string;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: readonly AssetDiagnostic[];
}
export interface GltfSkippedMeshSourceAsset {
    readonly kind: GltfMeshSourceAssetRegistrationKind;
    readonly plannedHandleKey: string;
    readonly registeredHandleKey: string;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly reason: GltfMeshSourceAssetRegistrationDiagnosticCode;
    readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
}
export interface GltfMeshSourceAssetRegistrationOptions {
    readonly registry: AssetRegistry;
    readonly report: GltfMeshAssetConstructionReport;
}
export interface GltfMeshSourceAssetRegistrationReport {
    readonly valid: boolean;
    readonly written: readonly GltfRegisteredMeshSourceAsset[];
    readonly skipped: readonly GltfSkippedMeshSourceAsset[];
    readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
}
export type GltfMeshSourceAssetRegistrationReportJsonValue = GltfMeshSourceAssetRegistrationReport;
export declare function registerGltfMeshSourceAssetsFromConstructionReport(options: GltfMeshSourceAssetRegistrationOptions): GltfMeshSourceAssetRegistrationReport;
export declare function gltfMeshSourceAssetRegistrationReportToJsonValue(report: GltfMeshSourceAssetRegistrationReport): GltfMeshSourceAssetRegistrationReportJsonValue;
export declare function gltfMeshSourceAssetRegistrationReportToJson(report: GltfMeshSourceAssetRegistrationReport): string;
//# sourceMappingURL=gltf-mesh-source-registration.d.ts.map