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
import type { BuiltInShaderBindingMetadata } from "../unlit/unlit-shader.js";

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

  if (features.iblSpecularProof === true || features.iblSpecularBrdf === true) {
    bindings.push({
      id: "standardSpecularIblTexture",
      label: "Standard material specular IBL cube texture",
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
    bindings.push({
      id: "standardMorphTargetDeltas",
      label: "Standard material morph target deltas",
      group: 1,
      binding: 4,
      resource: "read-only-storage-buffer",
    });
    bindings.push({
      id: "standardMorphInstanceDescriptors",
      label: "Standard material morph instance descriptors",
      group: 1,
      binding: 5,
      resource: "read-only-storage-buffer",
    });
  }

  return bindings;
}
