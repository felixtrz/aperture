import { appendStandardSkinningFeatureName } from "./standard-skinning-shader.js";
import { appendStandardMorphTargetFeatureName } from "./standard-morph-target-shader.js";

export const STANDARD_DIRECT_LIGHT_SHADER_VARIANT =
  "direct-lit-metallic-roughness";
export const STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT =
  "direct-lit-metallic-roughness-base-color-texture";
export const STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT =
  "direct-lit-metallic-roughness-texture";
export const STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT =
  "direct-lit-metallic-roughness-base-color-metallic-roughness-texture";
export const STANDARD_SHADOW_MAP_SHADER_VARIANT =
  "direct-lit-metallic-roughness-shadow-map";
export const STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT =
  "direct-lit-metallic-roughness-cascaded-shadow-map";
export const STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT =
  "direct-lit-metallic-roughness-point-shadow-map";
export const STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT =
  "direct-lit-metallic-roughness-multi-shadow-map";
export const STANDARD_DIFFUSE_IBL_SHADER_VARIANT =
  "direct-lit-metallic-roughness-diffuse-ibl";
export const STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT =
  "direct-lit-metallic-roughness-diffuse-specular-ibl-proof";
export const STANDARD_CLEARCOAT_SHADER_VARIANT =
  "direct-lit-metallic-roughness-clearcoat";
export const STANDARD_TRANSMISSION_SHADER_VARIANT =
  "direct-lit-metallic-roughness-transmission";
export const STANDARD_SHEEN_SHADER_VARIANT =
  "direct-lit-metallic-roughness-sheen";
export const STANDARD_IRIDESCENCE_SHADER_VARIANT =
  "direct-lit-metallic-roughness-iridescence";

export interface StandardTextureShaderFeatures {
  readonly baseColorTexture: boolean;
  readonly metallicRoughnessTexture: boolean;
  readonly clearcoatTexture?: boolean;
  readonly clearcoatRoughnessTexture?: boolean;
  readonly transmissionTexture?: boolean;
  readonly sheenColorTexture?: boolean;
  readonly sheenRoughnessTexture?: boolean;
  readonly iridescenceTexture?: boolean;
  readonly iridescenceThicknessTexture?: boolean;
  readonly normalTexture: boolean;
  readonly occlusionTexture: boolean;
  readonly emissiveTexture: boolean;
  readonly shadowMap?: boolean;
  readonly cascadedShadowMap?: boolean;
  readonly pointShadowMap?: boolean;
  readonly iblDiffuse?: boolean;
  readonly iblSpecularProof?: boolean;
  readonly texCoord1?: boolean;
  readonly vertexColor?: boolean;
  readonly instanceTint?: boolean;
  readonly skinned?: boolean;
  readonly morphed?: boolean;
  readonly clearcoat?: boolean;
  readonly transmission?: boolean;
  readonly sheen?: boolean;
  readonly iridescence?: boolean;
  readonly fogLinear?: boolean;
  readonly fogExp?: boolean;
  readonly fogExp2?: boolean;
  readonly clusteredLocalLights?: boolean;
  readonly clusteredLocalLightCookies?: boolean;
  readonly clusteredLocalLightShadowCookies?: boolean;
  readonly clusteredLocalLightArrayCookies?: boolean;
  readonly clusteredLocalLightCubeCookies?: boolean;
  readonly clusteredLocalLightArrayShadows?: boolean;
  readonly clusteredLocalLightPointArrayShadows?: boolean;
}

export const STANDARD_MATERIAL_MVP_LIGHTING_MODEL = {
  variant: STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
  brdf: "Cook-Torrance GGX direct lighting with Schlick Fresnel and Lambert diffuse.",
  supported: [
    "baseColorFactor",
    "baseColorTexture",
    "metallicFactor",
    "roughnessFactor",
    "metallicRoughnessTexture",
    "normalTexture",
    "emissiveFactor",
    "emissiveTexture",
    "occlusionTexture",
    "ambientLight",
    "directionalLight",
    "rectAreaLight",
    "diskAreaLight",
    "sphereAreaLight",
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
    "linearFog",
    "exponentialFog",
    "exponentialSquaredFog",
  ],
  deferred: ["imageBasedLighting", "shadows"],
} as const;

export function createStandardTextureShaderVariantKey(
  features: StandardTextureShaderFeatures,
): string {
  if (!hasAnyStandardTextureFeature(features)) {
    return STANDARD_DIRECT_LIGHT_SHADER_VARIANT;
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
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT;
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
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return STANDARD_SHADOW_MAP_SHADER_VARIANT;
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
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT;
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
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT;
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
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true &&
    features.vertexColor !== true &&
    features.instanceTint !== true &&
    features.skinned !== true &&
    features.morphed !== true &&
    !hasStandardGenericOnlyFeature(features)
  ) {
    return STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT;
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof !== true &&
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
    return STANDARD_DIFFUSE_IBL_SHADER_VARIANT;
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof === true &&
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
    return STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT;
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
    return STANDARD_CLEARCOAT_SHADER_VARIANT;
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
    return STANDARD_TRANSMISSION_SHADER_VARIANT;
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
    return STANDARD_SHEEN_SHADER_VARIANT;
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
    return STANDARD_IRIDESCENCE_SHADER_VARIANT;
  }

  const names: string[] = [];

  if (features.baseColorTexture) {
    names.push("base-color");
  }

  if (features.metallicRoughnessTexture) {
    names.push("metallic-roughness");
  }

  if (features.clearcoatTexture === true) {
    names.push("clearcoat-texture");
  }

  if (features.clearcoatRoughnessTexture === true) {
    names.push("clearcoat-roughness-texture");
  }

  if (features.transmissionTexture === true) {
    names.push("transmission-texture");
  }

  if (features.sheenColorTexture === true) {
    names.push("sheen-color-texture");
  }

  if (features.sheenRoughnessTexture === true) {
    names.push("sheen-roughness-texture");
  }

  if (features.iridescenceTexture === true) {
    names.push("iridescence-texture");
  }

  if (features.iridescenceThicknessTexture === true) {
    names.push("iridescence-thickness-texture");
  }

  if (features.normalTexture) {
    names.push("normal-map");
  }

  if (features.occlusionTexture) {
    names.push("occlusion");
  }

  if (features.emissiveTexture) {
    names.push("emissive");
  }

  if (features.shadowMap === true) {
    names.push("shadow-map");
  }

  if (features.cascadedShadowMap === true) {
    names.push("cascaded");
  }

  if (features.pointShadowMap === true) {
    names.push("point-shadow-map");
  }

  if (features.clusteredLocalLightArrayShadows === true) {
    names.push("clustered-local-light-array-shadows");
  }

  if (features.clusteredLocalLightPointArrayShadows === true) {
    names.push("clustered-local-light-point-array-shadows");
  }

  if (features.iblDiffuse === true) {
    names.push("diffuse-ibl");
  }

  if (features.iblSpecularProof === true) {
    names.push("specular-ibl-proof");
  }

  if (features.texCoord1 === true) {
    names.push("uv1");
  }

  if (features.vertexColor === true) {
    names.push("vertex-color");
  }

  if (features.instanceTint === true) {
    names.push("instance-tint");
  }

  if (features.clearcoat === true) {
    names.push("clearcoat");
  }

  if (features.transmission === true) {
    names.push("transmission");
  }

  if (features.sheen === true) {
    names.push("sheen");
  }

  if (features.iridescence === true) {
    names.push("iridescence");
  }

  if (features.clusteredLocalLights === true) {
    names.push("clustered-local-lights");
  }

  if (features.clusteredLocalLightCubeCookies === true) {
    names.push("clustered-local-light-cube-cookies");
  } else if (features.clusteredLocalLightArrayCookies === true) {
    names.push("clustered-local-light-array-cookies");
  } else if (features.clusteredLocalLightShadowCookies === true) {
    names.push("clustered-local-light-shadow-cookies");
  } else if (features.clusteredLocalLightCookies === true) {
    names.push("clustered-local-light-cookies");
  }

  appendStandardSkinningFeatureName(names, features);
  appendStandardMorphTargetFeatureName(names, features);
  appendStandardFogFeatureName(names, features);

  return `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-${names.join("-")}-texture`;
}

export function standardTextureFeatureNames(
  features: StandardTextureShaderFeatures,
): string[] {
  const names: string[] = [];

  if (features.baseColorTexture) {
    names.push("base-color");
  }

  if (features.metallicRoughnessTexture) {
    names.push("metallic-roughness");
  }

  if (features.clearcoatTexture === true) {
    names.push("clearcoat-texture");
  }

  if (features.clearcoatRoughnessTexture === true) {
    names.push("clearcoat-roughness-texture");
  }

  if (features.transmissionTexture === true) {
    names.push("transmission-texture");
  }

  if (features.sheenColorTexture === true) {
    names.push("sheen-color-texture");
  }

  if (features.sheenRoughnessTexture === true) {
    names.push("sheen-roughness-texture");
  }

  if (features.iridescenceTexture === true) {
    names.push("iridescence-texture");
  }

  if (features.iridescenceThicknessTexture === true) {
    names.push("iridescence-thickness-texture");
  }

  if (features.normalTexture) {
    names.push("normal-map");
  }

  if (features.occlusionTexture) {
    names.push("occlusion");
  }

  if (features.emissiveTexture) {
    names.push("emissive");
  }

  if (features.shadowMap === true) {
    names.push("shadow-map");
  }

  if (features.cascadedShadowMap === true) {
    names.push("cascaded");
  }

  if (features.pointShadowMap === true) {
    names.push("point-shadow-map");
  }

  if (features.clusteredLocalLightPointArrayShadows === true) {
    names.push("clustered-local-light-point-array-shadows");
  }

  if (features.iblDiffuse === true) {
    names.push("diffuse-ibl");
  }

  if (features.iblSpecularProof === true) {
    names.push("specular-ibl-proof");
  }

  if (features.texCoord1 === true) {
    names.push("uv1");
  }

  if (features.vertexColor === true) {
    names.push("vertex-color");
  }

  if (features.instanceTint === true) {
    names.push("instance-tint");
  }

  if (features.clearcoat === true) {
    names.push("clearcoat");
  }

  if (features.transmission === true) {
    names.push("transmission");
  }

  if (features.sheen === true) {
    names.push("sheen");
  }

  if (features.iridescence === true) {
    names.push("iridescence");
  }

  if (features.clusteredLocalLights === true) {
    names.push("clustered-local-lights");
  }

  appendStandardSkinningFeatureName(names, features);
  appendStandardMorphTargetFeatureName(names, features);
  appendStandardFogFeatureName(names, features);

  return names;
}

export function appendStandardFogFeatureName(
  names: string[],
  features: StandardTextureShaderFeatures,
): void {
  if (features.fogLinear === true) {
    names.push("fog-linear");
  }

  if (features.fogExp === true) {
    names.push("fog-exp");
  }

  if (features.fogExp2 === true) {
    names.push("fog-exp2");
  }
}

export function hasStandardFogFeature(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.fogLinear === true ||
    features.fogExp === true ||
    features.fogExp2 === true
  );
}

export function hasStandardGenericOnlyFeature(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.clearcoat === true ||
    features.transmission === true ||
    features.transmissionTexture === true ||
    features.sheenColorTexture === true ||
    features.sheenRoughnessTexture === true ||
    features.sheen === true ||
    features.iridescence === true ||
    features.iridescenceTexture === true ||
    features.iridescenceThicknessTexture === true ||
    features.clusteredLocalLights === true ||
    features.clusteredLocalLightCookies === true ||
    features.clusteredLocalLightPointArrayShadows === true ||
    hasStandardFogFeature(features)
  );
}

export function hasAnyStandardTextureFeature(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.baseColorTexture ||
    features.metallicRoughnessTexture ||
    features.clearcoatTexture === true ||
    features.clearcoatRoughnessTexture === true ||
    features.transmissionTexture === true ||
    features.sheenColorTexture === true ||
    features.sheenRoughnessTexture === true ||
    features.iridescenceTexture === true ||
    features.iridescenceThicknessTexture === true ||
    features.normalTexture ||
    features.occlusionTexture ||
    features.emissiveTexture ||
    features.shadowMap === true ||
    features.cascadedShadowMap === true ||
    features.pointShadowMap === true ||
    features.iblDiffuse === true ||
    features.iblSpecularProof === true ||
    features.texCoord1 === true ||
    features.vertexColor === true ||
    features.instanceTint === true ||
    features.skinned === true ||
    features.morphed === true ||
    features.clearcoat === true ||
    features.transmission === true ||
    features.sheen === true ||
    features.iridescence === true ||
    features.clusteredLocalLights === true ||
    features.clusteredLocalLightCookies === true ||
    features.clusteredLocalLightPointArrayShadows === true ||
    hasStandardFogFeature(features)
  );
}
