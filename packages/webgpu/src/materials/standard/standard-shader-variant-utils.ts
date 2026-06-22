import {
  standardTextureFeatureNames,
  type StandardTextureShaderFeatures,
} from "./standard-shader-features.js";

export function usesCompactClusteredLocalMultiShadow(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.clusteredLocalLights === true &&
    features.shadowMap === true &&
    features.pointShadowMap === true &&
    features.cascadedShadowMap !== true
  );
}

export function standardTextureVariantComment(
  features: StandardTextureShaderFeatures,
): string {
  const active = standardTextureFeatureNames(features);

  const deferred =
    features.shadowMap === true || features.pointShadowMap === true
      ? "image-based lighting is"
      : "image-based lighting and shadows are";

  return `// Direct lights use a small metallic/roughness GGX BRDF. ${active.join(
    ", ",
  )} features are active; ${deferred} deferred.`;
}

export function standardTextureUvExpression(
  features: StandardTextureShaderFeatures,
  field:
    | "baseColor"
    | "metallicRoughness"
    | "clearcoat"
    | "clearcoatRoughness"
    | "transmission"
    | "sheenColor"
    | "sheenRoughness"
    | "iridescence"
    | "iridescenceThickness"
    | "normal"
    | "occlusion"
    | "emissive",
): string {
  if (features.texCoord1 !== true) {
    return "input.uv";
  }

  const texCoordField =
    field === "transmission"
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
