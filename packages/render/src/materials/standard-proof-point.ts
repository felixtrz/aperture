import type { StandardMaterialAsset } from "./types.js";

export type StandardMaterialProofPointFeature =
  | "baseColorFactor"
  | "metallicFactor"
  | "roughnessFactor"
  | "emissiveFactor"
  | "alphaMode"
  | "depthState"
  | "cullState"
  | "ambientLight"
  | "directionalLight";

export type DeferredStandardMaterialFeature =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture"
  | "imageBasedLighting"
  | "shadows"
  | "transmission"
  | "clearcoat";

export const STANDARD_MATERIAL_PROOF_POINT_SCOPE = {
  supported: [
    "baseColorFactor",
    "metallicFactor",
    "roughnessFactor",
    "emissiveFactor",
    "alphaMode",
    "depthState",
    "cullState",
    "ambientLight",
    "directionalLight",
  ],
  deferred: [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
    "imageBasedLighting",
    "shadows",
    "transmission",
    "clearcoat",
  ],
} as const satisfies {
  readonly supported: readonly StandardMaterialProofPointFeature[];
  readonly deferred: readonly DeferredStandardMaterialFeature[];
};

export type StandardMaterialProofPointDiagnosticCode =
  | "standardMaterial.invalidFactor"
  | "standardMaterial.invalidColor"
  | "standardMaterial.deferredFeature"
  | "standardMaterial.unsupportedFeature";

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

export function validateStandardMaterialProofPoint(
  material: StandardMaterialAsset,
): StandardMaterialProofPointValidationReport {
  const diagnostics: StandardMaterialProofPointDiagnostic[] = [];

  validateColor(material.baseColorFactor, "baseColorFactor", diagnostics);
  validateColor([...material.emissiveFactor, 1], "emissiveFactor", diagnostics);
  validateUnitFactor(material.metallicFactor, "metallicFactor", diagnostics);
  validateUnitFactor(material.roughnessFactor, "roughnessFactor", diagnostics);

  if (material.baseColorTexture !== null) {
    deferred("baseColorTexture", diagnostics);
  }

  if (material.metallicRoughnessTexture !== null) {
    deferred("metallicRoughnessTexture", diagnostics);
  }

  if (material.normalTexture !== null) {
    deferred("normalTexture", diagnostics);
  }

  if (material.occlusionTexture !== null) {
    deferred("occlusionTexture", diagnostics);
  }

  if (material.emissiveTexture !== null) {
    deferred("emissiveTexture", diagnostics);
  }

  for (const feature of material.unsupportedFeatures) {
    diagnostics.push({
      code: "standardMaterial.unsupportedFeature",
      field: feature,
      severity: "error",
      message: `StandardMaterial proof point does not support '${feature}'.`,
    });
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    supportedFeatures: STANDARD_MATERIAL_PROOF_POINT_SCOPE.supported,
    deferredFeatures: STANDARD_MATERIAL_PROOF_POINT_SCOPE.deferred,
    diagnostics,
  };
}

function validateUnitFactor(
  value: number,
  field: string,
  diagnostics: StandardMaterialProofPointDiagnostic[],
): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    diagnostics.push({
      code: "standardMaterial.invalidFactor",
      field,
      severity: "error",
      message: `${field} must be a finite value between 0 and 1.`,
    });
  }
}

function validateColor(
  values: ArrayLike<number>,
  field: string,
  diagnostics: StandardMaterialProofPointDiagnostic[],
): void {
  for (let index = 0; index < 4; index += 1) {
    const value = values[index];

    if (value === undefined || !Number.isFinite(value)) {
      diagnostics.push({
        code: "standardMaterial.invalidColor",
        field,
        severity: "error",
        message: `${field} must contain finite numeric color values.`,
      });
      return;
    }
  }
}

function deferred(
  field: DeferredStandardMaterialFeature,
  diagnostics: StandardMaterialProofPointDiagnostic[],
): void {
  diagnostics.push({
    code: "standardMaterial.deferredFeature",
    field,
    severity: "warning",
    message: `${field} is deferred for the StandardMaterial proof point.`,
  });
}
