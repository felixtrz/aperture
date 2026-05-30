import {
  hasStandardFogFeature,
  hasStandardGenericOnlyFeature,
  standardTextureFeatureNames,
  type StandardTextureShaderFeatures,
} from "./standard-shader-features.js";

export function standardTextureVariantShaderLabel(
  features: StandardTextureShaderFeatures,
): string {
  if (
    features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-base-color-textured";
  }

  if (
    features.metallicRoughnessTexture &&
    !features.baseColorTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-metallic-roughness-textured";
  }

  if (
    features.baseColorTexture &&
    features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-base-color-metallic-roughness-textured";
  }

  if (
    features.shadowMap === true &&
    features.cascadedShadowMap !== true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-shadow-receiver";
  }

  if (
    features.shadowMap === true &&
    features.cascadedShadowMap === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-cascaded-shadow-receiver";
  }

  if (
    features.pointShadowMap === true &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.iblDiffuse !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-point-shadow-receiver";
  }

  if (
    features.shadowMap === true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.iblDiffuse !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-multi-shadow-receiver";
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return "aperture/standard-mesh-diffuse-ibl";
  }

  if (
    features.iblDiffuse === true &&
    (features.iblSpecularProof === true || features.iblSpecularBrdf === true) &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return features.iblSpecularBrdf === true
      ? "aperture/standard-mesh-diffuse-specular-ibl-brdf"
      : "aperture/standard-mesh-diffuse-specular-ibl-proof";
  }

  if (
    features.clearcoat === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    features.transmission !== true &&
    features.sheen !== true &&
    features.iridescence !== true &&
    !hasStandardFogFeature(features)
  ) {
    return "aperture/standard-mesh-clearcoat";
  }

  if (
    features.transmission === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    features.clearcoat !== true &&
    features.sheen !== true &&
    features.iridescence !== true &&
    !hasStandardFogFeature(features)
  ) {
    return "aperture/standard-mesh-transmission";
  }

  if (
    features.sheen === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    features.clearcoat !== true &&
    features.transmission !== true &&
    features.iridescence !== true &&
    !hasStandardFogFeature(features)
  ) {
    return "aperture/standard-mesh-sheen";
  }

  if (
    features.iridescence === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.cascadedShadowMap !== true &&
    features.pointShadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.iblSpecularBrdf !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    features.clearcoat !== true &&
    features.transmission !== true &&
    features.sheen !== true &&
    !hasStandardFogFeature(features)
  ) {
    return "aperture/standard-mesh-iridescence";
  }

  return `aperture/standard-mesh-${standardTextureFeatureNames(features).join(
    "-",
  )}-textured`;
}
