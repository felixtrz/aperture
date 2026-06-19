import { STANDARD_MESH_WGSL } from "./standard-shader-source.js";
import { addStandardSkinningVertexSlots } from "./standard-skinning-shader.js";
import { addStandardMorphTargetVertexSlots } from "./standard-morph-target-shader.js";
import {
  hasAnyStandardTextureFeature,
  hasStandardFogFeature,
  type StandardTextureShaderFeatures,
} from "./standard-shader-features.js";
import {
  standardTextureUvExpression,
  standardTextureVariantBindings,
  standardTextureVariantComment,
  standardTextureVariantDeclaration,
  standardTextureVariantShaderLabel,
  usesCompactClusteredLocalMultiShadow,
} from "./standard-shader-variant.js";
import {
  applyStandardClearcoatSampling,
  applyStandardClusteredLocalLightSampling,
  applyStandardFogSampling,
  applyStandardIridescenceSampling,
  applyStandardMultiShadowMapSampling,
  applyStandardPointShadowMapSampling,
  applyStandardShadowMapSampling,
  applyStandardSheenSampling,
  applyStandardSpecularIblBrdfSampling,
  applyStandardSpecularIblProofSampling,
  standardClearcoatMaterialStatements,
  standardIridescenceMaterialStatements,
  standardSheenMaterialStatements,
  standardTransmissionColorMutationStatements,
} from "./standard-shader-sampling.js";
import {
  createStandardFragmentComposer,
  replaceStandardFragmentSlots,
  STANDARD_AMBIENT_DIFFUSE_BRDF_EXPRESSION,
} from "./standard-shader-composer.js";
import {
  createStandardVertexComposer,
  replaceStandardVertexSlots,
} from "./standard-vertex-composer.js";
import {
  STANDARD_DIFFUSE_IBL_SAMPLE_WGSL,
  STANDARD_SPECULAR_IBL_BRDF_SAMPLE_WGSL,
  STANDARD_SPECULAR_IBL_PROOF_SAMPLE_WGSL,
} from "./standard-shader-ibl-sampling.js";
import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
import type {
  BuiltInShaderBindingId,
  BuiltInShaderBindingMetadata,
  BuiltInShaderMetadataDiagnostic,
  BuiltInShaderMetadataValidationReport,
  BuiltInShaderSourceModule,
} from "../unlit/unlit-shader.js";

export {
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT,
  STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_CLEARCOAT_SHADER_VARIANT,
  STANDARD_DIFFUSE_IBL_SHADER_VARIANT,
  STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
  STANDARD_IRIDESCENCE_SHADER_VARIANT,
  STANDARD_MATERIAL_MVP_LIGHTING_MODEL,
  STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_SHEEN_SHADER_VARIANT,
  STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT,
  STANDARD_TRANSMISSION_SHADER_VARIANT,
  createStandardTextureShaderVariantKey,
  type StandardTextureShaderFeatures,
} from "./standard-shader-features.js";

export { STANDARD_MESH_WGSL } from "./standard-shader-source.js";

export const STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL =
  createStandardTextureVariantWgsl({
    baseColorTexture: true,
    metallicRoughnessTexture: false,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
  });

export const STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL =
  createStandardTextureVariantWgsl({
    baseColorTexture: false,
    metallicRoughnessTexture: true,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
  });

export const STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL =
  createStandardTextureVariantWgsl({
    baseColorTexture: true,
    metallicRoughnessTexture: true,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
  });
export const STANDARD_SHADOW_RECEIVER_MESH_WGSL =
  createStandardTextureVariantWgsl({
    baseColorTexture: false,
    metallicRoughnessTexture: false,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
    shadowMap: true,
  });

export const STANDARD_CASCADED_SHADOW_RECEIVER_MESH_WGSL =
  createStandardTextureVariantWgsl({
    baseColorTexture: false,
    metallicRoughnessTexture: false,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
    shadowMap: true,
    cascadedShadowMap: true,
  });

export const STANDARD_MESH_SHADER: BuiltInShaderSourceModule = {
  label: "aperture/standard-mesh",
  code: STANDARD_MESH_WGSL,
  entryPoints: {
    vertex: "vs_main",
    fragment: "fs_main",
  },
  bindings: [
    {
      id: "viewProjection",
      label: "View projection uniform",
      group: 0,
      binding: 0,
      resource: "uniform-buffer",
    },
    {
      id: "worldTransforms",
      label: "World transform matrix storage",
      group: 1,
      binding: 0,
      resource: "read-only-storage-buffer",
    },
    {
      id: "standardMaterial",
      label: "Standard material uniform",
      group: 2,
      binding: 0,
      resource: "uniform-buffer",
    },
    {
      id: "lightFloats",
      label: "Packed light float storage",
      group: 3,
      binding: 0,
      resource: "read-only-storage-buffer",
    },
    {
      id: "lightMetadata",
      label: "Packed light metadata storage",
      group: 3,
      binding: 1,
      resource: "read-only-storage-buffer",
    },
  ],
};

export const STANDARD_BASE_COLOR_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule =
  createStandardTextureVariantShader({
    baseColorTexture: true,
    metallicRoughnessTexture: false,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
  });

export const STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule =
  createStandardTextureVariantShader({
    baseColorTexture: false,
    metallicRoughnessTexture: true,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
  });

export const STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule =
  createStandardTextureVariantShader({
    baseColorTexture: true,
    metallicRoughnessTexture: true,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
  });
export const STANDARD_SHADOW_RECEIVER_MESH_SHADER: BuiltInShaderSourceModule =
  createStandardTextureVariantShader({
    baseColorTexture: false,
    metallicRoughnessTexture: false,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
    shadowMap: true,
  });

export function createStandardMeshShaderModuleDescriptor(
  shader: BuiltInShaderSourceModule = STANDARD_MESH_SHADER,
): WebGpuShaderModuleDescriptor {
  return {
    label: shader.label,
    code: shader.code,
    entryPoints: [shader.entryPoints.vertex, shader.entryPoints.fragment],
  };
}

export function validateStandardShaderMetadata(
  shader: BuiltInShaderSourceModule,
): BuiltInShaderMetadataValidationReport {
  const diagnostics: BuiltInShaderMetadataDiagnostic[] = [];

  if (shader.label.trim().length === 0) {
    diagnostics.push({
      code: "shaderMetadata.missingLabel",
      field: "label",
      message: "Built-in shader metadata requires a non-empty label.",
    });
  }

  if (shader.code.trim().length === 0) {
    diagnostics.push({
      code: "shaderMetadata.missingCode",
      field: "code",
      message: "Built-in shader metadata requires WGSL source code.",
    });
  }

  if (shader.entryPoints.vertex.trim().length === 0) {
    diagnostics.push({
      code: "shaderMetadata.missingEntryPoint",
      field: "entryPoints.vertex",
      message: "Built-in shader metadata requires a vertex entry point.",
    });
  }

  if (shader.entryPoints.fragment.trim().length === 0) {
    diagnostics.push({
      code: "shaderMetadata.missingEntryPoint",
      field: "entryPoints.fragment",
      message: "Built-in shader metadata requires a fragment entry point.",
    });
  }

  for (const id of [
    "viewProjection",
    "worldTransforms",
    "standardMaterial",
    "lightFloats",
    "lightMetadata",
  ] satisfies readonly BuiltInShaderBindingId[]) {
    if (!hasBinding(shader.bindings, id)) {
      diagnostics.push({
        code: "shaderMetadata.missingBinding",
        field: `bindings.${id}`,
        message: `Built-in shader metadata is missing '${id}' binding metadata.`,
      });
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

function hasBinding(
  bindings: readonly BuiltInShaderBindingMetadata[],
  id: BuiltInShaderBindingId,
): boolean {
  return bindings.some((binding) => binding.id === id);
}

export function createStandardTextureVariantShader(
  features: StandardTextureShaderFeatures,
): BuiltInShaderSourceModule {
  if (!hasAnyStandardTextureFeature(features)) {
    return STANDARD_MESH_SHADER;
  }

  return {
    label: standardTextureVariantShaderLabel(features),
    code: createStandardTextureVariantWgsl(features),
    entryPoints: STANDARD_MESH_SHADER.entryPoints,
    bindings: [
      ...STANDARD_MESH_SHADER.bindings,
      ...standardTextureVariantBindings(features),
    ],
  };
}

function createStandardTextureVariantWgsl(
  features: StandardTextureShaderFeatures,
): string {
  const baseColorUv = standardTextureUvExpression(features, "baseColor");
  const metallicRoughnessUv = standardTextureUvExpression(
    features,
    "metallicRoughness",
  );
  const clearcoatUv = standardTextureUvExpression(features, "clearcoat");
  const clearcoatRoughnessUv = standardTextureUvExpression(
    features,
    "clearcoatRoughness",
  );
  const transmissionUv = standardTextureUvExpression(features, "transmission");
  const sheenColorUv = standardTextureUvExpression(features, "sheenColor");
  const sheenRoughnessUv = standardTextureUvExpression(
    features,
    "sheenRoughness",
  );
  const iridescenceUv = standardTextureUvExpression(features, "iridescence");
  const iridescenceThicknessUv = standardTextureUvExpression(
    features,
    "iridescenceThickness",
  );
  const normalUv = standardTextureUvExpression(features, "normal");
  const occlusionUv = standardTextureUvExpression(features, "occlusion");
  const emissiveUv = standardTextureUvExpression(features, "emissive");
  let code = STANDARD_MESH_WGSL.replace(
    `// Direct lights use a small metallic/roughness GGX BRDF. Texture sampling,
// image-based lighting, and shadows are deferred.`,
    standardTextureVariantComment(features),
  ).replace(
    `@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;
@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;`,
    standardTextureVariantDeclaration(features),
  );
  const fragment = createStandardFragmentComposer();
  const vertex = createStandardVertexComposer();

  if (features.normalTexture) {
    vertex.addInputField("tangent", "  @location(3) tangent: vec4f,");
    vertex.addOutputField("worldTangent", "  @location(3) worldTangent: vec3f,");
    vertex.addOutputField("tangentSign", "  @location(4) tangentSign: f32,");
    vertex.enableTangentOutput();
    fragment.addHelperFunction(`fn sampleTangentSpaceNormal(input: VertexOutput, frontFacing: bool) -> vec3f {
  let normalTextureUv = standardTextureTransformUv(
    ${normalUv},
    material.normalTextureOffset,
    material.normalTextureScale,
    material.normalTextureRotation,
  );
  var tangentNormal = textureSample(normalTexture, normalSampler, normalTextureUv).xyz * 2.0 - vec3f(1.0);
  tangentNormal = normalize(vec3f(
    tangentNormal.xy * material.normalScale,
    tangentNormal.z,
  ));
  let normal = standardGeometryNormal(input.worldNormal, frontFacing);
  let tangent = normalize(input.worldTangent - normal * dot(input.worldTangent, normal));
  let bitangent = normalize(cross(normal, tangent) * input.tangentSign);
  return normalize(mat3x3f(tangent, bitangent, normal) * tangentNormal);
}`);
    fragment.setNormalExpression("sampleTangentSpaceNormal(input, frontFacing)");
  }

  if (features.texCoord1 === true) {
    vertex.addInputField("uv1", "  @location(4) uv1: vec2f,");
    vertex.addOutputField("uv1", "  @location(5) uv1: vec2f,");
    vertex.addPostUvOutputAssignment("  output.uv1 = input.uv1;");

    code = code.replace(
      `fn saturate(value: f32) -> f32 {`,
      `fn standardTextureUv(texCoord: u32, uv0: vec2f, uv1: vec2f) -> vec2f {
  if (texCoord == 1u) {
    return uv1;
  }

  return uv0;
}

fn saturate(value: f32) -> f32 {`,
    );
  }

  if (
    features.baseColorTexture ||
    features.metallicRoughnessTexture ||
    features.clearcoatTexture === true ||
    features.clearcoatRoughnessTexture === true ||
    features.transmissionTexture === true ||
    features.sheenColorTexture === true ||
    features.sheenRoughnessTexture === true ||
    features.iridescenceThicknessTexture === true ||
    features.normalTexture ||
    features.occlusionTexture ||
    features.emissiveTexture
  ) {
    code = code.replace(
      `fn saturate(value: f32) -> f32 {`,
      `fn standardTextureTransformUv(uv: vec2f, offset: vec2f, scale: vec2f, rotation: f32) -> vec2f {
  let scaled = uv * scale;
  let c = cos(rotation);
  let s = sin(rotation);
  let rotated = vec2f(
    scaled.x * c - scaled.y * s,
    scaled.x * s + scaled.y * c,
  );
  return rotated + offset;
}

fn saturate(value: f32) -> f32 {`,
    );
  }

  if (features.baseColorTexture) {
    fragment.addBaseColorAlphaStatement(`  let baseColorUv = standardTextureTransformUv(
    ${baseColorUv},
    material.baseColorTextureOffset,
    material.baseColorTextureScale,
    material.baseColorTextureRotation,
  );
  let baseColorSample = textureSample(baseColorTexture, baseColorSampler, baseColorUv);`);
    fragment.setBaseColorExpression(
      "baseColorSample.rgb * material.baseColorFactor.rgb",
    );
    fragment.setAlphaExpression(
      "baseColorSample.a * material.baseColorFactor.a",
    );
  }

  if (features.vertexColor === true) {
    vertex.addInputField("vertexColor", "  @location(5) color: vec4f,");
    vertex.addOutputField("vertexColor", "  @location(6) vertexColor: vec4f,");
    vertex.addPostUvOutputAssignment("  output.vertexColor = input.color;");
    fragment.multiplyBaseColorExpression("input.vertexColor.rgb");
    fragment.multiplyAlphaExpression("input.vertexColor.a");
  }

  if (features.instanceTint === true) {
    vertex.addInputField("instanceTint", "  @location(6) instanceTint: vec4f,");
    vertex.addOutputField("instanceTint", "  @location(7) instanceTint: vec4f,");
    vertex.addPostUvOutputAssignment(
      "  output.instanceTint = input.instanceTint;",
    );
    fragment.setBaseColorMutable();
    fragment.setAlphaMutable();
    fragment.addBaseColorAlphaMutation(
      "  baseColor = baseColor * input.instanceTint.rgb;",
    );
    fragment.addBaseColorAlphaMutation(
      "  alpha = alpha * input.instanceTint.a;",
    );
  }

  if (features.metallicRoughnessTexture) {
    fragment.addMetallicRoughnessStatement(`  let metallicRoughnessUv = standardTextureTransformUv(
    ${metallicRoughnessUv},
    material.metallicRoughnessTextureOffset,
    material.metallicRoughnessTextureScale,
    material.metallicRoughnessTextureRotation,
  );
  let metallicRoughnessSample = textureSample(
    metallicRoughnessTexture,
    metallicRoughnessSampler,
    metallicRoughnessUv,
  );`);
    fragment.setMetallicExpression(
      "clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0)",
    );
    fragment.setRoughnessExpression(
      "clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0)",
    );
  }

  if (features.occlusionTexture || features.emissiveTexture) {
    const occlusion = features.occlusionTexture
      ? `  let occlusionTextureUv = standardTextureTransformUv(
    ${occlusionUv},
    material.occlusionTextureOffset,
    material.occlusionTextureScale,
    material.occlusionTextureRotation,
  );
  let occlusionSample = textureSample(occlusionTexture, occlusionSampler, occlusionTextureUv);
  let occlusion = mix(1.0, occlusionSample.r, clamp(material.occlusionStrength, 0.0, 1.0));`
      : `  let occlusion = 1.0;`;
    const emissive = features.emissiveTexture
      ? `  let emissiveTextureUv = standardTextureTransformUv(
    ${emissiveUv},
    material.emissiveTextureOffset,
    material.emissiveTextureScale,
    material.emissiveTextureRotation,
  );
  let emissiveSample = textureSample(emissiveTexture, emissiveSampler, emissiveTextureUv);
  let emissive = material.emissiveFactor * emissiveSample.rgb;`
      : `  let emissive = material.emissiveFactor;`;

    fragment.addMaterialStatement(occlusion);
    fragment.addMaterialStatement(emissive);
    fragment.setIndirectDiffuseTerm(
      "ambientDiffuse",
      "ambientDiffuse",
      `  let ambientDiffuse = ${STANDARD_AMBIENT_DIFFUSE_BRDF_EXPRESSION} * occlusion;`,
    );
    fragment.replaceEmissiveTerm("emissiveTexture", "emissive");
  }

  if (features.shadowMap === true && features.pointShadowMap === true) {
    code = applyStandardMultiShadowMapSampling(code, {
      compactClusteredLocalShadows:
        usesCompactClusteredLocalMultiShadow(features),
      arrayShadows: features.clusteredLocalLightArrayShadows === true,
      pointArrayShadows: features.clusteredLocalLightPointArrayShadows === true,
    });
  } else if (features.shadowMap === true) {
    code = applyStandardShadowMapSampling(code, {
      cascaded: features.cascadedShadowMap === true,
      arrayShadows: features.clusteredLocalLightArrayShadows === true,
      // A spot is a single-2D perspective shadow that reuses the directional
      // shadow-map bindings; additionally shadow the spot light block.
      spotReceiver: features.spotShadowMap === true,
    });
  } else if (features.pointShadowMap === true) {
    code = applyStandardPointShadowMapSampling(code, {
      pointArrayShadows: features.clusteredLocalLightPointArrayShadows === true,
    });
  }

  const removeGlobalPointShadowReceiverFactor =
    features.clusteredLocalLights === true &&
    features.pointShadowMap === true &&
    features.shadowMap !== true;
  const removeGlobalSpotShadowReceiverFactor =
    features.clusteredLocalLights === true &&
    features.shadowMap === true &&
    (features.cascadedShadowMap !== true ||
      features.clusteredLocalLightArrayShadows === true);

  if (
    features.shadowMap === true &&
    features.pointShadowMap === true &&
    !removeGlobalSpotShadowReceiverFactor
  ) {
    fragment.addMaterialStatement(`  let receiverShadowFactor = min(
    min(
      sampleDirectionalShadowFactor(input.worldPosition),
      sampleSpotShadowFactor(input.worldPosition),
    ),
    samplePointShadowReceiverFactor(input.worldPosition),
  );`);
    fragment.setDirectTerm("receiverShadowDirect", "direct * receiverShadowFactor");
  } else if (
    features.pointShadowMap === true &&
    features.shadowMap !== true &&
    !removeGlobalPointShadowReceiverFactor
  ) {
    fragment.addMaterialStatement(
      "  let receiverPointShadowFactor = samplePointShadowReceiverFactor(input.worldPosition);",
    );
    fragment.setDirectTerm(
      "receiverPointShadowDirect",
      "direct * receiverPointShadowFactor",
    );
  }

  if (features.iblDiffuse === true) {
    fragment.addIndirectDiffuseTerm(
      "diffuseIbl",
      "diffuseIbl",
      STANDARD_DIFFUSE_IBL_SAMPLE_WGSL,
    );
  }

  if (features.iblSpecularBrdf === true) {
    code = applyStandardSpecularIblBrdfSampling(code);
    fragment.addIndirectSpecularTerm(
      "specularIblBrdf",
      "specularIblBrdf",
      STANDARD_SPECULAR_IBL_BRDF_SAMPLE_WGSL,
    );
  } else if (features.iblSpecularProof === true) {
    code = applyStandardSpecularIblProofSampling(code);
    fragment.addIndirectSpecularTerm(
      "specularIblProof",
      "specularIblProof",
      STANDARD_SPECULAR_IBL_PROOF_SAMPLE_WGSL,
    );
  }

  if (features.clearcoat === true) {
    fragment.addMetallicRoughnessStatement(
      standardClearcoatMaterialStatements({
        textureSample:
          features.clearcoatTexture === true
            ? `textureSample(clearcoatTexture, clearcoatSampler, ${clearcoatUv}).r`
            : null,
        roughnessTextureSample:
          features.clearcoatRoughnessTexture === true
            ? `textureSample(clearcoatRoughnessTexture, clearcoatRoughnessSampler, ${clearcoatRoughnessUv}).g`
            : null,
      }),
    );
    code = applyStandardClearcoatSampling(code, {
      textureSample:
        features.clearcoatTexture === true
          ? `textureSample(clearcoatTexture, clearcoatSampler, ${clearcoatUv}).r`
          : null,
      roughnessTextureSample:
        features.clearcoatRoughnessTexture === true
          ? `textureSample(clearcoatRoughnessTexture, clearcoatRoughnessSampler, ${clearcoatRoughnessUv}).g`
          : null,
    });
  }

  if (features.sheen === true) {
    fragment.addMetallicRoughnessStatement(
      standardSheenMaterialStatements({
        colorTextureSample:
          features.sheenColorTexture === true
            ? `textureSample(sheenColorTexture, sheenColorSampler, ${sheenColorUv}).rgb`
            : null,
        roughnessTextureSample:
          features.sheenRoughnessTexture === true
            ? `textureSample(sheenRoughnessTexture, sheenRoughnessSampler, ${sheenRoughnessUv}).a`
            : null,
      }),
    );
    code = applyStandardSheenSampling(code, {
      colorTextureSample:
        features.sheenColorTexture === true
          ? `textureSample(sheenColorTexture, sheenColorSampler, ${sheenColorUv}).rgb`
          : null,
      roughnessTextureSample:
        features.sheenRoughnessTexture === true
          ? `textureSample(sheenRoughnessTexture, sheenRoughnessSampler, ${sheenRoughnessUv}).a`
          : null,
    });
  }

  if (features.iridescence === true) {
    fragment.addMetallicRoughnessStatement(
      standardIridescenceMaterialStatements({
        textureSample:
          features.iridescenceTexture === true
            ? `textureSample(iridescenceTexture, iridescenceSampler, ${iridescenceUv}).r`
            : null,
        thicknessTextureSample:
          features.iridescenceThicknessTexture === true
            ? `textureSample(iridescenceThicknessTexture, iridescenceThicknessSampler, ${iridescenceThicknessUv}).g`
            : null,
      }),
    );
    code = applyStandardIridescenceSampling(code, {
      textureSample:
        features.iridescenceTexture === true
          ? `textureSample(iridescenceTexture, iridescenceSampler, ${iridescenceUv}).r`
          : null,
      thicknessTextureSample:
        features.iridescenceThicknessTexture === true
          ? `textureSample(iridescenceThicknessTexture, iridescenceThicknessSampler, ${iridescenceThicknessUv}).g`
          : null,
    });
  }

  if (features.transmission === true) {
    fragment.setAlphaMutable();
    fragment.addColorMutationStatement(
      standardTransmissionColorMutationStatements({
        textureSample:
          features.transmissionTexture === true
            ? `textureSample(transmissionTexture, transmissionSampler, ${transmissionUv}).r`
            : null,
      }),
    );
  }

  if (hasStandardFogFeature(features)) {
    code = applyStandardFogSampling(code, features);
    fragment.addColorMutationStatement(
      "  let foggedColor = applyDistanceFog(color, length(view.cameraPosition.xyz - input.worldPosition));",
    );
    fragment.addColorMutationStatement(
      "  let standardIndirectFoggedColor = applyDistanceFog(standardIndirectColor, length(view.cameraPosition.xyz - input.worldPosition));",
    );
    fragment.setOutputColorExpression("foggedColor");
    fragment.setIndirectOutputColorExpression("standardIndirectFoggedColor");
  }

  if (features.clusteredLocalLights === true) {
    code = applyStandardClusteredLocalLightSampling(code, {
      pointShadowMap: features.pointShadowMap === true,
      pointArrayShadowMap:
        features.clusteredLocalLightPointArrayShadows === true,
      spotShadowMap:
        features.shadowMap === true &&
        (features.cascadedShadowMap !== true ||
          features.clusteredLocalLightArrayShadows === true),
      localLightCookies: features.clusteredLocalLightCookies === true,
      localLightShadowCookies:
        features.clusteredLocalLightShadowCookies === true,
      localLightArrayCookies: features.clusteredLocalLightArrayCookies === true,
      localLightCubeCookies: features.clusteredLocalLightCubeCookies === true,
      removeGlobalPointShadowReceiverFactor:
        removeGlobalPointShadowReceiverFactor,
      removeGlobalSpotShadowReceiverFactor:
        removeGlobalSpotShadowReceiverFactor,
    });
  }

  addStandardSkinningVertexSlots(vertex, features);
  addStandardMorphTargetVertexSlots(vertex, features);

  if (features.morphed === true) {
    vertex.addLocalStatement(
      "  let morphed = apertureMorph(input.position, input.normal, input.instanceIndex, input.morphVertexIndex);",
    );
  }

  if (features.skinned === true) {
    const skinPositionExpression =
      features.morphed === true ? "morphed.position" : "input.position";
    const skinNormalExpression =
      features.morphed === true ? "morphed.normal" : "input.normal";

    vertex.addLocalStatement(
      `  let skinnedPosition = apertureSkinPosition(${skinPositionExpression}, input.joints0, input.weights0);`,
    );
    vertex.addLocalStatement(
      `  let skinnedNormal = apertureSkinDirection(${skinNormalExpression}, input.joints0, input.weights0);`,
    );
    vertex.setLocalPositionExpression("skinnedPosition");
    vertex.setLocalNormalExpression("skinnedNormal");

    if (features.normalTexture === true) {
      vertex.addLocalStatement(
        "  let skinnedTangent = apertureSkinDirection(input.tangent.xyz, input.joints0, input.weights0);",
      );
      vertex.setLocalTangentExpression("skinnedTangent");
    }
  } else if (features.morphed === true) {
    vertex.setLocalPositionExpression("morphed.position");
    vertex.setLocalNormalExpression("morphed.normal");
  }

  return replaceStandardVertexSlots(
    replaceStandardFragmentSlots(code, fragment),
    vertex,
  );
}
