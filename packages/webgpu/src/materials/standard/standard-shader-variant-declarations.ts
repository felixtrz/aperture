import {
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
} from "../../lighting/local-light-clusters.js";
import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";
import { usesCompactClusteredLocalMultiShadow } from "./standard-shader-variant-utils.js";

export function standardTextureVariantDeclaration(
  features: StandardTextureShaderFeatures,
): string {
  const compactClusteredLocalMultiShadow =
    usesCompactClusteredLocalMultiShadow(features);
  const declarations = [
    "@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;",
  ];

  if (features.baseColorTexture) {
    declarations.push(
      "@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;",
      "@group(2) @binding(2) var baseColorSampler: sampler;",
    );
  }

  if (features.metallicRoughnessTexture) {
    declarations.push(
      "@group(2) @binding(3) var metallicRoughnessTexture: texture_2d<f32>;",
      "@group(2) @binding(4) var metallicRoughnessSampler: sampler;",
    );
  }

  if (features.clearcoatTexture === true) {
    declarations.push(
      "@group(2) @binding(11) var clearcoatTexture: texture_2d<f32>;",
      "@group(2) @binding(12) var clearcoatSampler: sampler;",
    );
  }

  if (features.clearcoatRoughnessTexture === true) {
    declarations.push(
      "@group(2) @binding(23) var clearcoatRoughnessTexture: texture_2d<f32>;",
      "@group(2) @binding(24) var clearcoatRoughnessSampler: sampler;",
    );
  }

  if (features.transmissionTexture === true) {
    declarations.push(
      "@group(2) @binding(13) var transmissionTexture: texture_2d<f32>;",
      "@group(2) @binding(14) var transmissionSampler: sampler;",
    );
  }

  if (features.sheenColorTexture === true) {
    declarations.push(
      "@group(2) @binding(15) var sheenColorTexture: texture_2d<f32>;",
      "@group(2) @binding(16) var sheenColorSampler: sampler;",
    );
  }

  if (features.sheenRoughnessTexture === true) {
    declarations.push(
      "@group(2) @binding(19) var sheenRoughnessTexture: texture_2d<f32>;",
      "@group(2) @binding(20) var sheenRoughnessSampler: sampler;",
    );
  }

  if (features.iridescenceTexture === true) {
    declarations.push(
      "@group(2) @binding(17) var iridescenceTexture: texture_2d<f32>;",
      "@group(2) @binding(18) var iridescenceSampler: sampler;",
    );
  }

  if (features.iridescenceThicknessTexture === true) {
    declarations.push(
      "@group(2) @binding(21) var iridescenceThicknessTexture: texture_2d<f32>;",
      "@group(2) @binding(22) var iridescenceThicknessSampler: sampler;",
    );
  }

  if (features.normalTexture) {
    declarations.push(
      "@group(2) @binding(5) var normalTexture: texture_2d<f32>;",
      "@group(2) @binding(6) var normalSampler: sampler;",
    );
  }

  if (features.occlusionTexture) {
    declarations.push(
      "@group(2) @binding(7) var occlusionTexture: texture_2d<f32>;",
      "@group(2) @binding(8) var occlusionSampler: sampler;",
    );
  }

  if (features.emissiveTexture) {
    declarations.push(
      "@group(2) @binding(9) var emissiveTexture: texture_2d<f32>;",
      "@group(2) @binding(10) var emissiveSampler: sampler;",
    );
  }

  if (features.shadowMap === true) {
    const directionalShadowMapType =
      features.cascadedShadowMap === true ||
      features.clusteredLocalLightArrayShadows === true
        ? "texture_depth_2d_array"
        : "texture_depth_2d";

    declarations.push(
      "@group(3) @binding(2) var<storage, read> directionalShadowMatrices: array<mat4x4f>;",
      `@group(3) @binding(3) var directionalShadowMap: ${directionalShadowMapType};`,
      "@group(3) @binding(4) var directionalShadowSampler: sampler_comparison;",
    );

    if (features.pointShadowMap === true && !compactClusteredLocalMultiShadow) {
      declarations.push(
        "@group(3) @binding(5) var<storage, read> spotShadowMatrices: array<mat4x4f>;",
        "@group(3) @binding(6) var spotShadowMap: texture_depth_2d;",
        "@group(3) @binding(7) var spotShadowSampler: sampler_comparison;",
      );
    }
  }

  if (features.pointShadowMap === true) {
    const matrixBinding = features.shadowMap === true ? 8 : 2;
    const textureBinding = features.shadowMap === true ? 9 : 3;
    const samplerBinding = features.shadowMap === true ? 10 : 4;
    const pointShadowMapType =
      features.clusteredLocalLightPointArrayShadows === true
        ? "texture_depth_2d_array"
        : "texture_depth_cube";

    declarations.push(
      `@group(3) @binding(${matrixBinding}) var<storage, read> pointShadowMatrices: array<mat4x4f>;`,
      `@group(3) @binding(${textureBinding}) var pointShadowMap: ${pointShadowMapType};`,
      `@group(3) @binding(${samplerBinding}) var pointShadowSampler: sampler_comparison;`,
    );
  }

  if (features.iblDiffuse === true) {
    declarations.push(
      "@group(3) @binding(5) var standardDiffuseIblTexture: texture_cube<f32>;",
      "@group(3) @binding(6) var standardIblSampler: sampler;",
    );
  }

  if (features.iblSpecularProof === true) {
    declarations.push(
      "@group(3) @binding(7) var standardSpecularIblTexture: texture_cube<f32>;",
    );
  }

  if (features.transmission === true) {
    declarations.push(
      "@group(3) @binding(14) var standardTransmissionSceneColorTexture: texture_2d<f32>;",
      "@group(3) @binding(15) var standardTransmissionSceneColorSampler: sampler;",
    );
  }

  if (features.clusteredLocalLights === true) {
    declarations.push(
      `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_PARAMS_BINDING}) var<storage, read> localLightClusterParams: array<f32>;`,
      `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_CELLS_BINDING}) var<storage, read> localLightClusterCells: array<u32>;`,
      `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_INDICES_BINDING}) var<storage, read> localLightClusterIndices: array<u32>;`,
      `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_METADATA_BINDING}) var<storage, read> localLightClusterMetadata: array<u32>;`,
    );

    if (features.clusteredLocalLightCookies === true) {
      const cookieTextureType =
        features.clusteredLocalLightCubeCookies === true
          ? "texture_cube<f32>"
          : features.clusteredLocalLightArrayCookies === true
            ? "texture_2d_array<f32>"
            : "texture_2d<f32>";

      declarations.push(
        `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING}) var localLightClusterCookieTexture: ${cookieTextureType};`,
        `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING}) var localLightClusterCookieSampler: sampler;`,
      );

      if (features.clusteredLocalLightShadowCookies !== true) {
        declarations.push(
          `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING}) var<storage, read> localLightClusterCookieMatrices: array<mat4x4f>;`,
        );
      }
    }
  }

  declarations.push(
    "@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;",
  );

  return declarations.join("\n");
}
