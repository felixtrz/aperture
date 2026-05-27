import {
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
} from "../../lighting/local-light-clusters.js";
import {
  hasStandardFogFeature,
  hasStandardGenericOnlyFeature,
  standardTextureFeatureNames,
  type StandardTextureShaderFeatures,
} from "./standard-shader-features.js";
import type { BuiltInShaderBindingMetadata } from "../unlit/unlit-shader.js";

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

export function standardTextureVariantBindings(
  features: StandardTextureShaderFeatures,
): BuiltInShaderBindingMetadata[] {
  const compactClusteredLocalMultiShadow =
    usesCompactClusteredLocalMultiShadow(features);
  const bindings: BuiltInShaderBindingMetadata[] = [];

  if (features.baseColorTexture) {
    bindings.push(
      {
        id: "baseColorTexture",
        label: "Base color texture",
        group: 2,
        binding: 1,
        resource: "texture",
      },
      {
        id: "baseColorSampler",
        label: "Base color sampler",
        group: 2,
        binding: 2,
        resource: "sampler",
      },
    );
  }

  if (features.metallicRoughnessTexture) {
    bindings.push(
      {
        id: "metallicRoughnessTexture",
        label: "Metallic roughness texture",
        group: 2,
        binding: 3,
        resource: "texture",
      },
      {
        id: "metallicRoughnessSampler",
        label: "Metallic roughness sampler",
        group: 2,
        binding: 4,
        resource: "sampler",
      },
    );
  }

  if (features.clearcoatTexture === true) {
    bindings.push(
      {
        id: "clearcoatTexture",
        label: "Clearcoat texture",
        group: 2,
        binding: 11,
        resource: "texture",
      },
      {
        id: "clearcoatSampler",
        label: "Clearcoat sampler",
        group: 2,
        binding: 12,
        resource: "sampler",
      },
    );
  }

  if (features.clearcoatRoughnessTexture === true) {
    bindings.push(
      {
        id: "clearcoatRoughnessTexture",
        label: "Clearcoat roughness texture",
        group: 2,
        binding: 23,
        resource: "texture",
      },
      {
        id: "clearcoatRoughnessSampler",
        label: "Clearcoat roughness sampler",
        group: 2,
        binding: 24,
        resource: "sampler",
      },
    );
  }

  if (features.transmissionTexture === true) {
    bindings.push(
      {
        id: "transmissionTexture",
        label: "Transmission texture",
        group: 2,
        binding: 13,
        resource: "texture",
      },
      {
        id: "transmissionSampler",
        label: "Transmission sampler",
        group: 2,
        binding: 14,
        resource: "sampler",
      },
    );
  }

  if (features.sheenColorTexture === true) {
    bindings.push(
      {
        id: "sheenColorTexture",
        label: "Sheen color texture",
        group: 2,
        binding: 15,
        resource: "texture",
      },
      {
        id: "sheenColorSampler",
        label: "Sheen color sampler",
        group: 2,
        binding: 16,
        resource: "sampler",
      },
    );
  }

  if (features.sheenRoughnessTexture === true) {
    bindings.push(
      {
        id: "sheenRoughnessTexture",
        label: "Sheen roughness texture",
        group: 2,
        binding: 19,
        resource: "texture",
      },
      {
        id: "sheenRoughnessSampler",
        label: "Sheen roughness sampler",
        group: 2,
        binding: 20,
        resource: "sampler",
      },
    );
  }

  if (features.iridescenceTexture === true) {
    bindings.push(
      {
        id: "iridescenceTexture",
        label: "Iridescence texture",
        group: 2,
        binding: 17,
        resource: "texture",
      },
      {
        id: "iridescenceSampler",
        label: "Iridescence sampler",
        group: 2,
        binding: 18,
        resource: "sampler",
      },
    );
  }

  if (features.iridescenceThicknessTexture === true) {
    bindings.push(
      {
        id: "iridescenceThicknessTexture",
        label: "Iridescence thickness texture",
        group: 2,
        binding: 21,
        resource: "texture",
      },
      {
        id: "iridescenceThicknessSampler",
        label: "Iridescence thickness sampler",
        group: 2,
        binding: 22,
        resource: "sampler",
      },
    );
  }

  if (features.normalTexture) {
    bindings.push(
      {
        id: "normalTexture",
        label: "Normal texture",
        group: 2,
        binding: 5,
        resource: "texture",
      },
      {
        id: "normalSampler",
        label: "Normal sampler",
        group: 2,
        binding: 6,
        resource: "sampler",
      },
    );
  }

  if (features.occlusionTexture) {
    bindings.push(
      {
        id: "occlusionTexture",
        label: "Occlusion texture",
        group: 2,
        binding: 7,
        resource: "texture",
      },
      {
        id: "occlusionSampler",
        label: "Occlusion sampler",
        group: 2,
        binding: 8,
        resource: "sampler",
      },
    );
  }

  if (features.emissiveTexture) {
    bindings.push(
      {
        id: "emissiveTexture",
        label: "Emissive texture",
        group: 2,
        binding: 9,
        resource: "texture",
      },
      {
        id: "emissiveSampler",
        label: "Emissive sampler",
        group: 2,
        binding: 10,
        resource: "sampler",
      },
    );
  }

  if (features.shadowMap === true) {
    bindings.push(
      {
        id: "directionalShadowMatrices",
        label: "Directional shadow view-projection matrix storage",
        group: 3,
        binding: 2,
        resource: "read-only-storage-buffer",
      },
      {
        id: "directionalShadowMap",
        label: "Directional shadow depth texture",
        group: 3,
        binding: 3,
        resource: "texture",
      },
      {
        id: "directionalShadowSampler",
        label: "Directional shadow comparison sampler",
        group: 3,
        binding: 4,
        resource: "sampler",
      },
    );

    if (features.pointShadowMap === true && !compactClusteredLocalMultiShadow) {
      bindings.push(
        {
          id: "directionalShadowMatrices",
          label: "Spot shadow view-projection matrix storage",
          group: 3,
          binding: 5,
          resource: "read-only-storage-buffer",
        },
        {
          id: "directionalShadowMap",
          label: "Spot shadow depth texture",
          group: 3,
          binding: 6,
          resource: "texture",
        },
        {
          id: "directionalShadowSampler",
          label: "Spot shadow comparison sampler",
          group: 3,
          binding: 7,
          resource: "sampler",
        },
      );
    }
  }

  if (features.pointShadowMap === true) {
    const matrixBinding = features.shadowMap === true ? 8 : 2;
    const textureBinding = features.shadowMap === true ? 9 : 3;
    const samplerBinding = features.shadowMap === true ? 10 : 4;

    bindings.push(
      {
        id: "directionalShadowMatrices",
        label: "Point shadow cube-face view-projection matrix storage",
        group: 3,
        binding: matrixBinding,
        resource: "read-only-storage-buffer",
      },
      {
        id: "directionalShadowMap",
        label:
          features.clusteredLocalLightPointArrayShadows === true
            ? "Point shadow flattened cube-face depth-array texture"
            : "Point shadow cube depth texture",
        group: 3,
        binding: textureBinding,
        resource: "texture",
      },
      {
        id: "directionalShadowSampler",
        label: "Point shadow comparison sampler",
        group: 3,
        binding: samplerBinding,
        resource: "sampler",
      },
    );
  }

  if (features.iblDiffuse === true) {
    bindings.push(
      {
        id: "standardDiffuseIblTexture",
        label: "Standard material diffuse IBL cube texture",
        group: 3,
        binding: 5,
        resource: "texture",
      },
      {
        id: "standardIblSampler",
        label: "Standard material IBL sampler",
        group: 3,
        binding: 6,
        resource: "sampler",
      },
    );
  }

  if (features.iblSpecularProof === true) {
    bindings.push({
      id: "standardSpecularIblTexture",
      label: "Standard material placeholder specular IBL cube texture",
      group: 3,
      binding: 7,
      resource: "texture",
    });
  }

  if (features.transmission === true) {
    bindings.push(
      {
        id: "standardTransmissionSceneColorTexture",
        label: "Standard material transmission scene color texture",
        group: 3,
        binding: 14,
        resource: "texture",
      },
      {
        id: "standardTransmissionSceneColorSampler",
        label: "Standard material transmission scene color sampler",
        group: 3,
        binding: 15,
        resource: "sampler",
      },
    );
  }

  if (features.clusteredLocalLights === true) {
    bindings.push(
      {
        id: "localLightClusterParams",
        label: "Standard material local-light cluster params",
        group: 3,
        binding: LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
        resource: "read-only-storage-buffer",
      },
      {
        id: "localLightClusterCells",
        label: "Standard material local-light cluster cells",
        group: 3,
        binding: LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
        resource: "read-only-storage-buffer",
      },
      {
        id: "localLightClusterIndices",
        label: "Standard material local-light cluster indices",
        group: 3,
        binding: LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
        resource: "read-only-storage-buffer",
      },
      {
        id: "localLightClusterMetadata",
        label: "Standard material local-light cluster metadata",
        group: 3,
        binding: LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
        resource: "read-only-storage-buffer",
      },
    );

    if (features.clusteredLocalLightCookies === true) {
      bindings.push(
        {
          id: "localLightClusterCookieTexture",
          label: "Standard material local-light cookie texture",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
          resource: "texture",
        },
        {
          id: "localLightClusterCookieSampler",
          label: "Standard material local-light cookie sampler",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
          resource: "sampler",
        },
      );

      if (features.clusteredLocalLightShadowCookies !== true) {
        bindings.push({
          id: "localLightClusterCookieMatrices",
          label: "Standard material local-light cookie matrices",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
          resource: "read-only-storage-buffer",
        });
      }
    }
  }

  if (features.skinned === true) {
    bindings.push({
      id: "skinJointMatrices",
      label: "Standard material skin joint matrices",
      group: 1,
      binding: 1,
      resource: "read-only-storage-buffer",
    });
  }

  if (features.morphed === true) {
    bindings.push({
      id: "standardMorphTargetWeights",
      label: "Standard material morph target weights",
      group: 1,
      binding: 2,
      resource: "read-only-storage-buffer",
    });
  }

  return bindings;
}

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
    return "aperture/standard-mesh-diffuse-specular-ibl-proof";
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
