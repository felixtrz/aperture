import { BUILT_IN_MATERIAL_KINDS, } from "./types.js";
export function isBuiltInMaterialKind(value) {
    return BUILT_IN_MATERIAL_KINDS.includes(value);
}
export function isValidCustomMaterialFamilyKey(value) {
    if (isBuiltInMaterialKind(value) || value.includes("|")) {
        return false;
    }
    return /^[a-z][a-z0-9_.-]*\/[a-z][a-z0-9_.-]*(?:\/[a-z][a-z0-9_.-]*)*$/.test(value);
}
export function isValidMaterialFamilyKey(value) {
    return isBuiltInMaterialKind(value) || isValidCustomMaterialFamilyKey(value);
}
export function isCustomWgslMaterialAsset(material) {
    return ("sourceDiscriminator" in material &&
        material.sourceDiscriminator === "custom-material-source" &&
        material.shaderLanguage === "wgsl");
}
//# sourceMappingURL=family-key.js.map