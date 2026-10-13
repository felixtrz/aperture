import { standardTextureFeatureNames, } from "./standard-shader-features.js";
export function usesCompactClusteredLocalMultiShadow(features) {
    return (features.clusteredLocalLights === true &&
        features.shadowMap === true &&
        features.pointShadowMap === true &&
        features.cascadedShadowMap !== true);
}
export function standardTextureVariantComment(features) {
    const active = standardTextureFeatureNames(features);
    const deferred = features.shadowMap === true || features.pointShadowMap === true
        ? "image-based lighting is"
        : "image-based lighting and shadows are";
    return `// Direct lights use a small metallic/roughness GGX BRDF. ${active.join(", ")} features are active; ${deferred} deferred.`;
}
export function standardTextureUvExpression(features, field) {
    if (features.texCoord1 !== true) {
        return "input.uv";
    }
    const texCoordField = field === "transmission"
        ? "transmissionTexCoordPadding.x"
        : field === "sheenColor"
            ? "transmissionTexCoordPadding.y"
            : field === "iridescence"
                ? "transmissionTexCoordPadding.z"
                : field === "sheenRoughness"
                    ? "transmissionTexCoordPadding.w"
                    : field === "iridescenceThickness"
                        ? "iridescenceThicknessTexCoordPadding.x"
                        : field === "clearcoatRoughness"
                            ? "iridescenceThicknessTexCoordPadding.y"
                            : `${field}TexCoord`;
    return `standardTextureUv(material.${texCoordField}, input.uv, input.uv1)`;
}
//# sourceMappingURL=standard-shader-variant-utils.js.map