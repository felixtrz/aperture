export function isScalarStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isBaseColorOnlyStandardMaterial(material) {
    return (material.baseColorTexture !== null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isMetallicRoughnessOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture !== null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isNormalOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture !== null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isOcclusionEmissiveOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        (material.occlusionTexture !== null || material.emissiveTexture !== null));
}
export function isClearcoatOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture !== null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isClearcoatRoughnessOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture !== null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isTransmissionOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture !== null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isSheenColorOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture !== null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isSheenRoughnessOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture !== null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isIridescenceOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture !== null &&
        material.iridescenceThicknessTexture === null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
export function isIridescenceThicknessOnlyStandardMaterial(material) {
    return (material.baseColorTexture === null &&
        material.metallicRoughnessTexture === null &&
        material.clearcoatTexture === null &&
        material.clearcoatRoughnessTexture === null &&
        material.transmissionTexture === null &&
        material.sheenColorTexture === null &&
        material.sheenRoughnessTexture === null &&
        material.iridescenceTexture === null &&
        material.iridescenceThicknessTexture !== null &&
        material.normalTexture === null &&
        material.occlusionTexture === null &&
        material.emissiveTexture === null);
}
//# sourceMappingURL=prepared-standard-material-classification.js.map