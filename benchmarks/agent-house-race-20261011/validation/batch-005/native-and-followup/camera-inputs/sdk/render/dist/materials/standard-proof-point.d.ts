import type { StandardMaterialAsset } from "./types.js";
export type StandardMaterialProofPointFeature = "baseColorFactor" | "baseColorTexture" | "metallicFactor" | "roughnessFactor" | "clearcoatFactor" | "clearcoatTexture" | "clearcoatRoughnessFactor" | "clearcoatRoughnessTexture" | "transmissionFactor" | "transmissionTexture" | "sheenColorFactor" | "sheenColorTexture" | "sheenRoughnessFactor" | "sheenRoughnessTexture" | "iridescenceFactor" | "iridescenceTexture" | "iridescenceThicknessTexture" | "iridescenceIor" | "iridescenceThicknessRange" | "metallicRoughnessTexture" | "normalTexture" | "emissiveFactor" | "occlusionTexture" | "emissiveTexture" | "alphaMode" | "depthState" | "cullState" | "ambientLight" | "directionalLight";
export type DeferredStandardMaterialFeature = "imageBasedLighting" | "shadows" | "transmissionGrabPass";
export declare const STANDARD_MATERIAL_PROOF_POINT_SCOPE: {
    readonly supported: readonly ["baseColorFactor", "baseColorTexture", "metallicFactor", "roughnessFactor", "clearcoatFactor", "clearcoatTexture", "clearcoatRoughnessFactor", "clearcoatRoughnessTexture", "transmissionFactor", "transmissionTexture", "sheenColorFactor", "sheenColorTexture", "sheenRoughnessFactor", "sheenRoughnessTexture", "iridescenceFactor", "iridescenceTexture", "iridescenceThicknessTexture", "iridescenceIor", "iridescenceThicknessRange", "metallicRoughnessTexture", "normalTexture", "emissiveFactor", "occlusionTexture", "emissiveTexture", "alphaMode", "depthState", "cullState", "ambientLight", "directionalLight"];
    readonly deferred: readonly ["imageBasedLighting", "shadows", "transmissionGrabPass"];
};
export type StandardMaterialProofPointDiagnosticCode = "standardMaterial.invalidFactor" | "standardMaterial.invalidColor" | "standardMaterial.deferredFeature" | "standardMaterial.unsupportedFeature";
export interface StandardMaterialProofPointDiagnostic {
    readonly code: StandardMaterialProofPointDiagnosticCode;
    readonly message: string;
    readonly field: string;
    readonly severity: "warning" | "error";
}
export interface StandardMaterialProofPointValidationReport {
    readonly valid: boolean;
    readonly supportedFeatures: readonly StandardMaterialProofPointFeature[];
    readonly deferredFeatures: readonly DeferredStandardMaterialFeature[];
    readonly diagnostics: readonly StandardMaterialProofPointDiagnostic[];
}
export declare function validateStandardMaterialProofPoint(material: StandardMaterialAsset): StandardMaterialProofPointValidationReport;
//# sourceMappingURL=standard-proof-point.d.ts.map