export const STANDARD_MATERIAL_PROOF_POINT_SCOPE = {
    supported: [
        "baseColorFactor",
        "baseColorTexture",
        "metallicFactor",
        "roughnessFactor",
        "clearcoatFactor",
        "clearcoatTexture",
        "clearcoatRoughnessFactor",
        "clearcoatRoughnessTexture",
        "transmissionFactor",
        "transmissionTexture",
        "sheenColorFactor",
        "sheenColorTexture",
        "sheenRoughnessFactor",
        "sheenRoughnessTexture",
        "iridescenceFactor",
        "iridescenceTexture",
        "iridescenceThicknessTexture",
        "iridescenceIor",
        "iridescenceThicknessRange",
        "metallicRoughnessTexture",
        "normalTexture",
        "emissiveFactor",
        "occlusionTexture",
        "emissiveTexture",
        "alphaMode",
        "depthState",
        "cullState",
        "ambientLight",
        "directionalLight",
    ],
    deferred: ["imageBasedLighting", "shadows", "transmissionGrabPass"],
};
export function validateStandardMaterialProofPoint(material) {
    const diagnostics = [];
    validateColor(material.baseColorFactor, "baseColorFactor", diagnostics);
    validateColor([...material.emissiveFactor, 1], "emissiveFactor", diagnostics);
    validateUnitFactor(material.metallicFactor, "metallicFactor", diagnostics);
    validateUnitFactor(material.roughnessFactor, "roughnessFactor", diagnostics);
    validateUnitFactor(material.clearcoatFactor, "clearcoatFactor", diagnostics);
    validateUnitFactor(material.clearcoatRoughnessFactor, "clearcoatRoughnessFactor", diagnostics);
    validateUnitFactor(material.transmissionFactor, "transmissionFactor", diagnostics);
    validateColor([...material.sheenColorFactor, 1], "sheenColorFactor", diagnostics);
    validateUnitFactor(material.sheenRoughnessFactor, "sheenRoughnessFactor", diagnostics);
    validateUnitFactor(material.iridescenceFactor, "iridescenceFactor", diagnostics);
    validateIridescenceIor(material.iridescenceIor, diagnostics);
    validateIridescenceThicknessRange(material, diagnostics);
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
function validateUnitFactor(value, field, diagnostics) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        diagnostics.push({
            code: "standardMaterial.invalidFactor",
            field,
            severity: "error",
            message: `${field} must be a finite value between 0 and 1.`,
        });
    }
}
function validateIridescenceIor(value, diagnostics) {
    if (!Number.isFinite(value) || value < 1 || value > 2.333) {
        diagnostics.push({
            code: "standardMaterial.invalidFactor",
            field: "iridescenceIor",
            severity: "error",
            message: "iridescenceIor must be a finite value between 1 and 2.333.",
        });
    }
}
function validateIridescenceThicknessRange(material, diagnostics) {
    if (!Number.isFinite(material.iridescenceThicknessMinimum) ||
        !Number.isFinite(material.iridescenceThicknessMaximum) ||
        material.iridescenceThicknessMinimum < 0 ||
        material.iridescenceThicknessMaximum < material.iridescenceThicknessMinimum) {
        diagnostics.push({
            code: "standardMaterial.invalidFactor",
            field: "iridescenceThicknessRange",
            severity: "error",
            message: "iridescence thickness range must contain finite non-negative values with maximum greater than or equal to minimum.",
        });
    }
}
function validateColor(values, field, diagnostics) {
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
//# sourceMappingURL=standard-proof-point.js.map