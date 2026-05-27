import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedAreaLightShapeId,
  PackedLightKindId,
} from "../../lighting/light-packing.js";
import {
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
} from "../../lighting/local-light-clusters.js";
import { applyStandardSkinningToWgsl } from "./standard-skinning-shader.js";
import { applyStandardMorphTargetsToWgsl } from "./standard-morph-target-shader.js";
import {
  hasAnyStandardTextureFeature,
  hasStandardFogFeature,
  hasStandardGenericOnlyFeature,
  standardTextureFeatureNames,
  type StandardTextureShaderFeatures,
} from "./standard-shader-features.js";
import {
  applyStandardClearcoatSampling,
  applyStandardClusteredLocalLightSampling,
  applyStandardDiffuseIblSampling,
  applyStandardFogSampling,
  applyStandardIridescenceSampling,
  applyStandardMultiShadowMapSampling,
  applyStandardPointShadowMapSampling,
  applyStandardShadowMapSampling,
  applyStandardSheenSampling,
  applyStandardSpecularIblProofSampling,
  applyStandardTransmissionSampling,
} from "./standard-shader-sampling.js";
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

export const STANDARD_MESH_WGSL = `
// StandardMaterial MVP shader.
// Direct lights use a small metallic/roughness GGX BRDF. Texture sampling,
// image-based lighting, and shadows are deferred.
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
};

struct StandardMaterialUniform {
  baseColorFactor: vec4f,
  emissiveFactor: vec3f,
  metallicFactor: f32,
  roughnessFactor: f32,
  normalScale: f32,
  occlusionStrength: f32,
  alphaCutoff: f32,
  featureFlags: u32,
  baseColorTexCoord: u32,
  metallicRoughnessTexCoord: u32,
  normalTexCoord: u32,
  occlusionTexCoord: u32,
  emissiveTexCoord: u32,
  baseColorTextureOffset: vec2f,
  baseColorTextureScale: vec2f,
  baseColorTextureRotation: f32,
  padding1: f32,
  metallicRoughnessTextureOffset: vec2f,
  metallicRoughnessTextureScale: vec2f,
  metallicRoughnessTextureRotation: f32,
  padding2: f32,
  normalTextureOffset: vec2f,
  normalTextureScale: vec2f,
  normalTextureRotation: f32,
  padding3: f32,
  occlusionTextureOffset: vec2f,
  occlusionTextureScale: vec2f,
  occlusionTextureRotation: f32,
  padding4: f32,
  emissiveTextureOffset: vec2f,
  emissiveTextureScale: vec2f,
  emissiveTextureRotation: f32,
  padding5: f32,
  clearcoatFactor: f32,
  clearcoatRoughnessFactor: f32,
  transmissionFactor: f32,
  clearcoatTexCoord: u32,
  sheenColorRoughnessFactor: vec4f,
  iridescenceFactorIorThickness: vec4f,
  transmissionTexCoordPadding: vec4u,
  iridescenceThicknessTexCoordPadding: vec4u,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
};

const PI: f32 = 3.141592653589793;
const PACKED_LIGHT_FLOAT_STRIDE: u32 = ${PACKED_LIGHT_FLOAT_STRIDE}u;
const PACKED_LIGHT_METADATA_STRIDE: u32 = ${PACKED_LIGHT_METADATA_STRIDE}u;
const LIGHT_KIND_AMBIENT: i32 = ${PackedLightKindId.Ambient};
const LIGHT_KIND_DIRECTIONAL: i32 = ${PackedLightKindId.Directional};
const LIGHT_KIND_POINT: i32 = ${PackedLightKindId.Point};
const LIGHT_KIND_SPOT: i32 = ${PackedLightKindId.Spot};
const LIGHT_KIND_RECT_AREA: i32 = ${PackedLightKindId.RectArea};
const AREA_LIGHT_SHAPE_RECT: i32 = ${PackedAreaLightShapeId.Rect};
const AREA_LIGHT_SHAPE_DISK: i32 = ${PackedAreaLightShapeId.Disk};
const AREA_LIGHT_SHAPE_SPHERE: i32 = ${PackedAreaLightShapeId.Sphere};
const STANDARD_FEATURE_ALPHA_MASK: u32 = 32u;

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;
@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;
@group(3) @binding(1) var<storage, read> lightMetadata: array<i32>;
@group(3) @binding(11) var standardAreaLightLtcMatrixTexture: texture_2d<f32>;
@group(3) @binding(12) var standardAreaLightLtcFresnelTexture: texture_2d<f32>;
@group(3) @binding(13) var standardAreaLightLtcSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  let worldPosition = world * vec4f(input.position, 1.0);
  output.position = view.viewProjection * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  return output;
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - saturate(cosTheta), 5.0);
}

fn distributionGGX(normal: vec3f, halfVector: vec3f, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;
  let nDotH = max(dot(normal, halfVector), 0.0);
  let denomTerm = nDotH * nDotH * (alpha2 - 1.0) + 1.0;
  return alpha2 / max(PI * denomTerm * denomTerm, 0.0001);
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
}

fn geometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {
  let nDotV = max(dot(normal, viewDir), 0.0);
  let nDotL = max(dot(normal, lightDir), 0.0);
  return geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
}

fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let nDotL = max(dot(normal, lightDir), 0.0);

  if (nDotL <= 0.0) {
    return vec3f(0.0);
  }

  let halfVector = normalize(viewDir + lightDir);
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);
  let distribution = distributionGGX(normal, halfVector, roughness);
  let visibility = geometrySmith(normal, viewDir, lightDir, roughness);
  let specular = (distribution * visibility * fresnel) /
    max(4.0 * max(dot(normal, viewDir), 0.0) * nDotL, 0.0001);
  let diffuse = ((vec3f(1.0) - fresnel) * (1.0 - metallic) * baseColor) / PI;
  var brdf = diffuse + specular;
  return brdf * radiance * nDotL;
}

fn lightCount() -> u32 {
  return arrayLength(&lightMetadata) / PACKED_LIGHT_METADATA_STRIDE;
}

fn lightFloatOffset(lightIndex: u32) -> u32 {
  return lightIndex * PACKED_LIGHT_FLOAT_STRIDE;
}

fn lightMetadataOffset(lightIndex: u32) -> u32 {
  return lightIndex * PACKED_LIGHT_METADATA_STRIDE;
}

fn lightKind(lightIndex: u32) -> i32 {
  return lightMetadata[lightMetadataOffset(lightIndex)];
}

fn lightRadiance(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);
  let color = vec3f(
    lightFloats[offset],
    lightFloats[offset + 1u],
    lightFloats[offset + 2u],
  );
  let intensity = lightFloats[offset + 4u];
  return color * intensity;
}

fn packedLightPosition(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 14u >= arrayLength(&lightFloats)) {
    return vec3f(0.0);
  }

  return vec3f(
    lightFloats[offset + 12u],
    lightFloats[offset + 13u],
    lightFloats[offset + 14u],
  );
}

fn packedLightDirection(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 17u >= arrayLength(&lightFloats)) {
    return vec3f(0.0, 0.0, -1.0);
  }

  return safeNormalize(
    vec3f(
      lightFloats[offset + 15u],
      lightFloats[offset + 16u],
      lightFloats[offset + 17u],
    ),
    vec3f(0.0, 0.0, -1.0),
  );
}

fn packedAreaLightHalfWidth(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 20u >= arrayLength(&lightFloats)) {
    if (offset + 8u >= arrayLength(&lightFloats)) {
      return vec3f(0.5, 0.0, 0.0);
    }

    return vec3f(max(lightFloats[offset + 8u], 0.0001) * 0.5, 0.0, 0.0);
  }

  return vec3f(
    lightFloats[offset + 18u],
    lightFloats[offset + 19u],
    lightFloats[offset + 20u],
  );
}

fn packedAreaLightHalfHeight(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 23u >= arrayLength(&lightFloats)) {
    if (offset + 9u >= arrayLength(&lightFloats)) {
      return vec3f(0.0, 0.5, 0.0);
    }

    return vec3f(0.0, max(lightFloats[offset + 9u], 0.0001) * 0.5, 0.0);
  }

  return vec3f(
    lightFloats[offset + 21u],
    lightFloats[offset + 22u],
    lightFloats[offset + 23u],
  );
}

fn lightTransformIndex(lightIndex: u32) -> u32 {
  let sourceOffset = lightMetadata[lightMetadataOffset(lightIndex) + 1u];

  if (sourceOffset <= 0) {
    return 0u;
  }

  return u32(sourceOffset) / 16u;
}

fn directionalLightDirection(lightIndex: u32) -> vec3f {
  return packedLightDirection(lightIndex);
}

fn pointLightPosition(lightIndex: u32) -> vec3f {
  return packedLightPosition(lightIndex);
}

fn pointLightRange(lightIndex: u32) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  return max(lightFloats[offset + 5u], 0.0001);
}

fn spotLightDirection(lightIndex: u32) -> vec3f {
  return packedLightDirection(lightIndex);
}

fn spotLightConeAttenuation(lightIndex: u32, lightToReceiver: vec3f) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  let inner = clamp(lightFloats[offset + 6u], 0.0, 3.14159);
  let outer = clamp(lightFloats[offset + 7u], inner, 3.14159);
  let cosTheta = dot(normalize(lightToReceiver), spotLightDirection(lightIndex));
  let innerCos = cos(inner);
  let outerCos = cos(outer);
  return saturate((cosTheta - outerCos) / max(innerCos - outerCos, 0.0001));
}

fn safeNormalize(value: vec3f, fallback: vec3f) -> vec3f {
  let valueLength = length(value);

  if (valueLength <= 0.0001) {
    return fallback;
  }

  return value / valueLength;
}

fn rectAreaLightSize(lightIndex: u32) -> vec2f {
  let offset = lightFloatOffset(lightIndex);
  return max(vec2f(lightFloats[offset + 8u], lightFloats[offset + 9u]), vec2f(0.0001));
}

fn areaLightShape(lightIndex: u32) -> i32 {
  let offset = lightFloatOffset(lightIndex);
  return i32(lightFloats[offset + 10u]);
}

fn rectAreaLightCenter(lightIndex: u32) -> vec3f {
  return packedLightPosition(lightIndex);
}

fn rectAreaLightHalfWidth(lightIndex: u32) -> vec3f {
  return packedAreaLightHalfWidth(lightIndex);
}

fn rectAreaLightHalfHeight(lightIndex: u32) -> vec3f {
  return packedAreaLightHalfHeight(lightIndex);
}

fn rectAreaLightNormal(lightIndex: u32) -> vec3f {
  return packedLightDirection(lightIndex);
}

fn areaLightLtcUv(normal: vec3f, viewDir: vec3f, roughness: f32) -> vec2f {
  let lutSize = 64.0;
  let lutScale = (lutSize - 1.0) / lutSize;
  let lutBias = 0.5 / lutSize;
  let nDotV = saturate(dot(normal, viewDir));
  let uv = vec2f(clamp(roughness, 0.0, 1.0), sqrt(1.0 - nDotV));
  return uv * lutScale + vec2f(lutBias);
}

fn areaLightLtcMatrix(texel: vec4f) -> mat3x3f {
  return mat3x3f(
    vec3f(texel.x, 0.0, texel.y),
    vec3f(0.0, 1.0, 0.0),
    vec3f(texel.z, 0.0, texel.w),
  );
}

fn areaLightLtcFresnel(texel: vec4f, specularColor: vec3f) -> vec3f {
  return specularColor * texel.x + (vec3f(1.0) - specularColor) * texel.y;
}

fn areaLightLtcScalarScale(matrixTexel: vec4f, fresnelTexel: vec4f) -> f32 {
  return max((matrixTexel.x + matrixTexel.z) * 0.5 * max(fresnelTexel.x, 0.04), 0.0001);
}

fn ltcIdentityMatrix() -> mat3x3f {
  return mat3x3f(
    vec3f(1.0, 0.0, 0.0),
    vec3f(0.0, 1.0, 0.0),
    vec3f(0.0, 0.0, 1.0),
  );
}

fn ltcTransposeMat3(matrix: mat3x3f) -> mat3x3f {
  return mat3x3f(
    vec3f(matrix[0].x, matrix[1].x, matrix[2].x),
    vec3f(matrix[0].y, matrix[1].y, matrix[2].y),
    vec3f(matrix[0].z, matrix[1].z, matrix[2].z),
  );
}

fn ltcClippedSphereFormFactor(vectorFormFactor: vec3f) -> f32 {
  let vectorLength = length(vectorFormFactor);
  return max(
    (vectorLength * vectorLength + vectorFormFactor.z) /
      max(vectorLength + 1.0, 0.0001),
    0.0,
  );
}

fn areaLightFiniteNonNegative(value: f32) -> f32 {
  if (value != value) {
    return 0.0;
  }

  return max(value, 0.0);
}

fn areaLightFiniteColor(color: vec3f) -> vec3f {
  return vec3f(
    areaLightFiniteNonNegative(color.x),
    areaLightFiniteNonNegative(color.y),
    areaLightFiniteNonNegative(color.z),
  );
}

fn ltcEdgeVectorFormFactor(v1: vec3f, v2: vec3f) -> vec3f {
  let x = clamp(dot(v1, v2), -0.9999, 0.9999);
  let y = abs(x);
  let a = 0.8543985 + (0.4965155 + 0.0145206 * y) * y;
  let b = 3.4175940 + (4.1616724 + y) * y;
  let v = a / b;
  var thetaSinTheta = v;

  if (x <= 0.0) {
    thetaSinTheta = 0.5 * inverseSqrt(max(1.0 - x * x, 0.0000001)) - v;
  }

  return cross(v1, v2) * thetaSinTheta;
}

fn ltcEvaluateRect(
  normal: vec3f,
  viewDir: vec3f,
  position: vec3f,
  inverseMatrix: mat3x3f,
  p0: vec3f,
  p1: vec3f,
  p2: vec3f,
  p3: vec3f,
) -> f32 {
  let lightEdge1 = p1 - p0;
  let lightEdge2 = p3 - p0;
  let lightNormal = cross(lightEdge1, lightEdge2);
  let handedness = sign(-dot(lightNormal, position - p0));
  let tangent = safeNormalize(
    viewDir - normal * dot(viewDir, normal),
    vec3f(1.0, 0.0, 0.0),
  );
  let bitangent = handedness * cross(normal, tangent);
  let basis = ltcTransposeMat3(mat3x3f(tangent, bitangent, normal));
  let ltcTransform = inverseMatrix * basis;
  let v0 = safeNormalize(ltcTransform * (p0 - position), vec3f(0.0, 0.0, 1.0));
  let v1 = safeNormalize(ltcTransform * (p1 - position), vec3f(0.0, 0.0, 1.0));
  let v2 = safeNormalize(ltcTransform * (p2 - position), vec3f(0.0, 0.0, 1.0));
  let v3 = safeNormalize(ltcTransform * (p3 - position), vec3f(0.0, 0.0, 1.0));
  let vectorFormFactor =
    ltcEdgeVectorFormFactor(v0, v1) +
    ltcEdgeVectorFormFactor(v1, v2) +
    ltcEdgeVectorFormFactor(v2, v3) +
    ltcEdgeVectorFormFactor(v3, v0);
  return saturate(ltcClippedSphereFormFactor(vectorFormFactor));
}

fn rectAreaLightFormFactor(
  normal: vec3f,
  viewDir: vec3f,
  position: vec3f,
  p0: vec3f,
  p1: vec3f,
  p2: vec3f,
  p3: vec3f,
) -> f32 {
  return ltcEvaluateRect(normal, viewDir, position, ltcIdentityMatrix(), p0, p1, p2, p3);
}

fn diskAreaLightFormFactor(
  lightIndex: u32,
  normal: vec3f,
  position: vec3f,
  center: vec3f,
  halfWidth: vec3f,
  halfHeight: vec3f,
) -> f32 {
  let toCenter = center - position;
  let distance2 = max(dot(toCenter, toCenter), 0.0001);
  let lightDir = safeNormalize(toCenter, normal);
  let receiverFacing = saturate(dot(normal, lightDir));
  let lightFacing = saturate(dot(rectAreaLightNormal(lightIndex), -lightDir));
  let diskArea = PI * max(length(halfWidth), 0.0001) * max(length(halfHeight), 0.0001);
  return saturate((diskArea * receiverFacing * lightFacing) / max(distance2 + diskArea, 0.0001));
}

fn sphereAreaLightFormFactor(
  normal: vec3f,
  position: vec3f,
  center: vec3f,
  radius: f32,
) -> f32 {
  let toCenter = center - position;
  let distance = max(length(toCenter), 0.0001);
  let lightDir = safeNormalize(toCenter, normal);
  let angularRadius = radius / distance;
  let receiverFacing = saturate((dot(normal, lightDir) + angularRadius) / (1.0 + angularRadius));
  let solidAngleApprox = (radius * radius) / max(distance * distance + radius * radius, 0.0001);
  return saturate(receiverFacing * solidAngleApprox);
}

fn areaLightFormFactor(
  lightIndex: u32,
  shape: i32,
  normal: vec3f,
  viewDir: vec3f,
  position: vec3f,
  center: vec3f,
  halfWidth: vec3f,
  halfHeight: vec3f,
) -> f32 {
  if (shape == AREA_LIGHT_SHAPE_DISK) {
    return diskAreaLightFormFactor(lightIndex, normal, position, center, halfWidth, halfHeight);
  }

  if (shape == AREA_LIGHT_SHAPE_SPHERE) {
    return sphereAreaLightFormFactor(normal, position, center, max(length(halfWidth), length(halfHeight)));
  }

  let p0 = center - halfWidth - halfHeight;
  let p1 = center + halfWidth - halfHeight;
  let p2 = center + halfWidth + halfHeight;
  let p3 = center - halfWidth + halfHeight;
  return rectAreaLightFormFactor(normal, viewDir, position, p0, p1, p2, p3);
}

fn evaluateAreaLight(
  lightIndex: u32,
  position: vec3f,
  normal: vec3f,
  viewDir: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let center = rectAreaLightCenter(lightIndex);
  let lightNormal = rectAreaLightNormal(lightIndex);
  let lightToReceiver = position - center;

  if (dot(lightNormal, lightToReceiver) <= 0.0) {
    return vec3f(0.0);
  }

  let halfWidth = rectAreaLightHalfWidth(lightIndex);
  let halfHeight = rectAreaLightHalfHeight(lightIndex);
  let shape = areaLightShape(lightIndex);
  var diffuseFactor = areaLightFormFactor(
    lightIndex,
    shape,
    normal,
    viewDir,
    position,
    center,
    halfWidth,
    halfHeight,
  );
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let ltcUv = areaLightLtcUv(normal, viewDir, roughness);
  let ltcMatrixTexel = textureSampleLevel(
    standardAreaLightLtcMatrixTexture,
    standardAreaLightLtcSampler,
    ltcUv,
    0.0,
  );
  let ltcFresnelTexel = textureSampleLevel(
    standardAreaLightLtcFresnelTexture,
    standardAreaLightLtcSampler,
    ltcUv,
    0.0,
  );
  var specularFactor =
    diffuseFactor * areaLightLtcScalarScale(ltcMatrixTexel, ltcFresnelTexel);

  if (shape == AREA_LIGHT_SHAPE_RECT) {
    let p0 = center - halfWidth - halfHeight;
    let p1 = center + halfWidth - halfHeight;
    let p2 = center + halfWidth + halfHeight;
    let p3 = center - halfWidth + halfHeight;
    diffuseFactor = rectAreaLightFormFactor(
      normal,
      viewDir,
      position,
      p0,
      p1,
      p2,
      p3,
    );
    specularFactor = ltcEvaluateRect(
      normal,
      viewDir,
      position,
      areaLightLtcMatrix(ltcMatrixTexel),
      p0,
      p1,
      p2,
      p3,
    );
  }

  diffuseFactor = areaLightFiniteNonNegative(diffuseFactor);
  specularFactor = areaLightFiniteNonNegative(specularFactor);

  if (diffuseFactor <= 0.0 && specularFactor <= 0.0) {
    return vec3f(0.0);
  }

  let fresnel = areaLightLtcFresnel(ltcFresnelTexel, f0);
  let diffuse = ((vec3f(1.0) - f0) * (1.0 - metallic) * baseColor) / PI;
  let specular = fresnel * specularFactor;
  return areaLightFiniteColor(
    (diffuse * diffuseFactor + specular) * lightRadiance(lightIndex),
  );
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let baseColor = material.baseColorFactor.rgb;
  let alpha = material.baseColorFactor.a;

  if ((material.featureFlags & STANDARD_FEATURE_ALPHA_MASK) != 0u && alpha < material.alphaCutoff) {
    discard;
  }

  let normal = normalize(input.worldNormal);
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  var ambient = vec3f(0.0);
  var direct = vec3f(0.0);

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    let kind = lightKind(lightIndex);

    if (kind == LIGHT_KIND_AMBIENT) {
      ambient = ambient + lightRadiance(lightIndex);
    }

    if (kind == LIGHT_KIND_DIRECTIONAL) {
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );
    }

    if (kind == LIGHT_KIND_POINT) {
      let lightPosition = pointLightPosition(lightIndex);
      let toLight = lightPosition - input.worldPosition;
      let lightDistance = length(toLight);
      let lightRange = pointLightRange(lightIndex);
      let attenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

      if (attenuation > 0.0 && lightDistance > 0.0001) {
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        );
      }
    }

    if (kind == LIGHT_KIND_SPOT) {
      let lightPosition = pointLightPosition(lightIndex);
      let toLight = lightPosition - input.worldPosition;
      let lightDistance = length(toLight);
      let lightRange = pointLightRange(lightIndex);
      let rangeAttenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

      if (rangeAttenuation > 0.0 && lightDistance > 0.0001) {
        let lightDir = toLight / lightDistance;
        let coneAttenuation = spotLightConeAttenuation(lightIndex, -lightDir);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          lightDir,
          lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
          baseColor,
          metallic,
          roughness,
        );
      }
    }

    if (kind == LIGHT_KIND_RECT_AREA) {
      direct = direct + evaluateAreaLight(
        lightIndex,
        input.worldPosition,
        normal,
        viewDir,
        baseColor,
        metallic,
        roughness,
      );
    }
  }

  let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
  let color = ambientDiffuse + direct + material.emissiveFactor;
  return vec4f(color, alpha);
}
`.trim();

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

function usesCompactClusteredLocalMultiShadow(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.clusteredLocalLights === true &&
    features.shadowMap === true &&
    features.pointShadowMap === true &&
    features.cascadedShadowMap !== true
  );
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

  if (features.normalTexture) {
    code = code
      .replace(
        `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};`,
        `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) tangent: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};`,
      )
      .replace(
        `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
};`,
        `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  @location(3) worldTangent: vec3f,
  @location(4) tangentSign: f32,
};`,
      )
      .replace(
        `  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.uv = input.uv;`,
        `  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.worldTangent = normalize((world * vec4f(input.tangent.xyz, 0.0)).xyz);
  output.tangentSign = input.tangent.w;
  output.uv = input.uv;`,
      )
      .replace(
        `fn evaluateDirectLight(
  normal: vec3f,`,
        `fn sampleTangentSpaceNormal(input: VertexOutput) -> vec3f {
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
  let normal = normalize(input.worldNormal);
  let tangent = normalize(input.worldTangent - normal * dot(input.worldTangent, normal));
  let bitangent = normalize(cross(normal, tangent) * input.tangentSign);
  return normalize(mat3x3f(tangent, bitangent, normal) * tangentNormal);
}

fn evaluateDirectLight(
  normal: vec3f,`,
      )
      .replace(
        `  let normal = normalize(input.worldNormal);
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);`,
        `  let normal = sampleTangentSpaceNormal(input);
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);`,
      );
  }

  if (features.texCoord1 === true) {
    if (features.normalTexture) {
      code = code
        .replace(
          `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) tangent: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};`,
          `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) tangent: vec4f,
  @location(4) uv1: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};`,
        )
        .replace(
          `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  @location(3) worldTangent: vec3f,
  @location(4) tangentSign: f32,
};`,
          `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  @location(3) worldTangent: vec3f,
  @location(4) tangentSign: f32,
  @location(5) uv1: vec2f,
};`,
        )
        .replace(
          `  output.tangentSign = input.tangent.w;
  output.uv = input.uv;`,
          `  output.tangentSign = input.tangent.w;
  output.uv = input.uv;
  output.uv1 = input.uv1;`,
        );
    } else {
      code = code
        .replace(
          `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};`,
          `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(4) uv1: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};`,
        )
        .replace(
          `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
};`,
          `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  @location(5) uv1: vec2f,
};`,
        )
        .replace(
          `  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.uv = input.uv;`,
          `  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  output.uv1 = input.uv1;`,
        );
    }

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
    code = code.replace(
      `  let baseColor = material.baseColorFactor.rgb;
  let alpha = material.baseColorFactor.a;`,
      `  let baseColorUv = standardTextureTransformUv(
    ${baseColorUv},
    material.baseColorTextureOffset,
    material.baseColorTextureScale,
    material.baseColorTextureRotation,
  );
  let baseColorSample = textureSample(baseColorTexture, baseColorSampler, baseColorUv);
  let baseColor = baseColorSample.rgb * material.baseColorFactor.rgb;
  let alpha = baseColorSample.a * material.baseColorFactor.a;`,
    );
  }

  if (features.vertexColor === true) {
    code = code
      .replace(
        `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,`,
        `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(5) color: vec4f,`,
      )
      .replace(
        `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,`,
        `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  @location(6) vertexColor: vec4f,`,
      )
      .replace(
        `  output.uv = input.uv;`,
        `  output.uv = input.uv;
  output.vertexColor = input.color;`,
      );

    if (features.baseColorTexture) {
      code = code.replace(
        `  let baseColor = baseColorSample.rgb * material.baseColorFactor.rgb;
  let alpha = baseColorSample.a * material.baseColorFactor.a;`,
        `  let baseColor = baseColorSample.rgb * material.baseColorFactor.rgb * input.vertexColor.rgb;
  let alpha = baseColorSample.a * material.baseColorFactor.a * input.vertexColor.a;`,
      );
    } else {
      code = code.replace(
        `  let baseColor = material.baseColorFactor.rgb;
  let alpha = material.baseColorFactor.a;`,
        `  let baseColor = material.baseColorFactor.rgb * input.vertexColor.rgb;
  let alpha = material.baseColorFactor.a * input.vertexColor.a;`,
      );
    }
  }

  if (features.instanceTint === true) {
    code = code
      .replace(
        `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,`,
        `struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(6) instanceTint: vec4f,`,
      )
      .replace(
        `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,`,
        `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  @location(7) instanceTint: vec4f,`,
      )
      .replace(
        `  output.uv = input.uv;`,
        `  output.uv = input.uv;
  output.instanceTint = input.instanceTint;`,
      )
      .replace(
        / {2}let baseColor = ([^;]+);\n {2}let alpha = ([^;]+);/u,
        `  var baseColor = $1;
  var alpha = $2;`,
      )
      .replace(
        `  if ((material.featureFlags & STANDARD_FEATURE_ALPHA_MASK) != 0u && alpha < material.alphaCutoff) {`,
        `  baseColor = baseColor * input.instanceTint.rgb;
  alpha = alpha * input.instanceTint.a;

  if ((material.featureFlags & STANDARD_FEATURE_ALPHA_MASK) != 0u && alpha < material.alphaCutoff) {`,
      );
  }

  if (features.metallicRoughnessTexture) {
    code = code.replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallicRoughnessUv = standardTextureTransformUv(
    ${metallicRoughnessUv},
    material.metallicRoughnessTextureOffset,
    material.metallicRoughnessTextureScale,
    material.metallicRoughnessTextureRotation,
  );
  let metallicRoughnessSample = textureSample(
    metallicRoughnessTexture,
    metallicRoughnessSampler,
    metallicRoughnessUv,
  );
  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
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

    code = code.replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `${occlusion}
${emissive}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * occlusion;
  let color = ambientDiffuse + direct + emissive;`,
    );
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
    });
  } else if (features.pointShadowMap === true) {
    code = applyStandardPointShadowMapSampling(code, {
      pointArrayShadows: features.clusteredLocalLightPointArrayShadows === true,
    });
  }

  if (features.iblDiffuse === true) {
    code = applyStandardDiffuseIblSampling(code);
  }

  if (features.iblSpecularProof === true) {
    code = applyStandardSpecularIblProofSampling(code);
  }

  if (features.clearcoat === true) {
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
    code = applyStandardTransmissionSampling(code, {
      textureSample:
        features.transmissionTexture === true
          ? `textureSample(transmissionTexture, transmissionSampler, ${transmissionUv}).r`
          : null,
    });
  }

  if (hasStandardFogFeature(features)) {
    code = applyStandardFogSampling(code, features);
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
        features.pointShadowMap === true && features.shadowMap !== true,
      removeGlobalSpotShadowReceiverFactor:
        features.shadowMap === true &&
        (features.cascadedShadowMap !== true ||
          features.clusteredLocalLightArrayShadows === true),
    });
  }

  return applyStandardMorphTargetsToWgsl(
    applyStandardSkinningToWgsl(code, features),
    features,
  );
}

function standardTextureVariantComment(
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

function standardTextureUvExpression(
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

function standardTextureVariantDeclaration(
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

function standardTextureVariantBindings(
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

function standardTextureVariantShaderLabel(
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
