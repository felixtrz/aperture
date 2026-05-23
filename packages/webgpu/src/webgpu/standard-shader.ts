import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedAreaLightShapeId,
  PackedLightKindId,
} from "./light-packing.js";
import {
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
} from "./local-light-clusters.js";
import {
  appendStandardSkinningFeatureName,
  applyStandardSkinningToWgsl,
} from "./standard-skinning-shader.js";
import {
  appendStandardMorphTargetFeatureName,
  applyStandardMorphTargetsToWgsl,
} from "./standard-morph-target-shader.js";
import type { WebGpuShaderModuleDescriptor } from "./shader.js";
import type {
  BuiltInShaderBindingId,
  BuiltInShaderBindingMetadata,
  BuiltInShaderMetadataDiagnostic,
  BuiltInShaderMetadataValidationReport,
  BuiltInShaderSourceModule,
} from "./unlit-shader.js";

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

fn lightTransformIndex(lightIndex: u32) -> u32 {
  let sourceOffset = lightMetadata[lightMetadataOffset(lightIndex) + 1u];

  if (sourceOffset <= 0) {
    return 0u;
  }

  return u32(sourceOffset) / 16u;
}

fn directionalLightDirection(lightIndex: u32) -> vec3f {
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return normalize(-world[2].xyz);
}

fn pointLightPosition(lightIndex: u32) -> vec3f {
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return world[3].xyz;
}

fn pointLightRange(lightIndex: u32) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  return max(lightFloats[offset + 5u], 0.0001);
}

fn spotLightDirection(lightIndex: u32) -> vec3f {
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return normalize(-world[2].xyz);
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
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return world[3].xyz;
}

fn rectAreaLightHalfWidth(lightIndex: u32) -> vec3f {
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return safeNormalize(world[0].xyz, vec3f(1.0, 0.0, 0.0)) * rectAreaLightSize(lightIndex).x * 0.5;
}

fn rectAreaLightHalfHeight(lightIndex: u32) -> vec3f {
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return safeNormalize(world[1].xyz, vec3f(0.0, 1.0, 0.0)) * rectAreaLightSize(lightIndex).y * 0.5;
}

fn rectAreaLightNormal(lightIndex: u32) -> vec3f {
  let world = worldTransforms[lightTransformIndex(lightIndex)];
  return safeNormalize(-world[2].xyz, vec3f(0.0, 0.0, -1.0));
}

fn areaLightLtcUv(normal: vec3f, viewDir: vec3f, roughness: f32) -> vec2f {
  let nDotV = saturate(dot(normal, viewDir));
  return vec2f(clamp(roughness, 0.0, 1.0), sqrt(1.0 - nDotV));
}

fn areaLightLtcScale(normal: vec3f, viewDir: vec3f, roughness: f32) -> f32 {
  let uv = areaLightLtcUv(normal, viewDir, roughness);
  let matrix = textureSampleLevel(
    standardAreaLightLtcMatrixTexture,
    standardAreaLightLtcSampler,
    uv,
    0.0,
  );
  let fresnel = textureSampleLevel(
    standardAreaLightLtcFresnelTexture,
    standardAreaLightLtcSampler,
    uv,
    0.0,
  );
  return max((matrix.x + matrix.z) * 0.5 * max(fresnel.x, 0.04), 0.0001);
}

fn ltcEdgeVectorFormFactor(v1: vec3f, v2: vec3f) -> vec3f {
  let edge = cross(v1, v2);
  let edgeLength = length(edge);

  if (edgeLength <= 0.0001) {
    return vec3f(0.0);
  }

  let angle = acos(clamp(dot(v1, v2), -0.9999, 0.9999));
  return edge * (angle / edgeLength);
}

fn rectAreaLightFormFactor(
  normal: vec3f,
  position: vec3f,
  p0: vec3f,
  p1: vec3f,
  p2: vec3f,
  p3: vec3f,
) -> f32 {
  let v0 = safeNormalize(p0 - position, normal);
  let v1 = safeNormalize(p1 - position, normal);
  let v2 = safeNormalize(p2 - position, normal);
  let v3 = safeNormalize(p3 - position, normal);
  let vectorFormFactor =
    ltcEdgeVectorFormFactor(v0, v1) +
    ltcEdgeVectorFormFactor(v1, v2) +
    ltcEdgeVectorFormFactor(v2, v3) +
    ltcEdgeVectorFormFactor(v3, v0);
  return saturate(abs(dot(normal, vectorFormFactor)) / (2.0 * PI));
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
  return rectAreaLightFormFactor(normal, position, p0, p1, p2, p3);
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
  let formFactor = areaLightFormFactor(
    lightIndex,
    areaLightShape(lightIndex),
    normal,
    position,
    center,
    halfWidth,
    halfHeight,
  );

  if (formFactor <= 0.0) {
    return vec3f(0.0);
  }

  let ltcScale = areaLightLtcScale(normal, viewDir, roughness);
  let lightDir = safeNormalize(center - position, normal);
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(viewDir, lightDir), 0.0), f0);
  let diffuse = ((vec3f(1.0) - fresnel) * (1.0 - metallic) * baseColor) / PI;
  let reflectionDir = reflect(-viewDir, normal);
  let specularPower = mix(64.0, 4.0, roughness);
  let specular = fresnel * pow(saturate(dot(reflectionDir, lightDir)), specularPower) * ltcScale;
  return (diffuse + specular) * lightRadiance(lightIndex) * formFactor;
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

  return `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-${names.join("-")}-texture`;
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
    code = applyStandardMultiShadowMapSampling(code);
  } else if (features.shadowMap === true) {
    code = applyStandardShadowMapSampling(code, {
      cascaded: features.cascadedShadowMap === true,
    });
  } else if (features.pointShadowMap === true) {
    code = applyStandardPointShadowMapSampling(code);
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
    code = applyStandardClusteredLocalLightSampling(code);
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
      features.cascadedShadowMap === true
        ? "texture_depth_2d_array"
        : "texture_depth_2d";

    declarations.push(
      "@group(3) @binding(2) var<storage, read> directionalShadowMatrices: array<mat4x4f>;",
      `@group(3) @binding(3) var directionalShadowMap: ${directionalShadowMapType};`,
      "@group(3) @binding(4) var directionalShadowSampler: sampler_comparison;",
    );

    if (features.pointShadowMap === true) {
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

    declarations.push(
      `@group(3) @binding(${matrixBinding}) var<storage, read> pointShadowMatrices: array<mat4x4f>;`,
      `@group(3) @binding(${textureBinding}) var pointShadowMap: texture_depth_cube;`,
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
    );
  }

  declarations.push(
    "@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;",
  );

  return declarations.join("\n");
}

function standardTextureVariantBindings(
  features: StandardTextureShaderFeatures,
): BuiltInShaderBindingMetadata[] {
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

    if (features.pointShadowMap === true) {
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
        label: "Point shadow cube depth texture",
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
    );
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

function standardTextureFeatureNames(
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

function appendStandardFogFeatureName(
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

function hasStandardFogFeature(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.fogLinear === true ||
    features.fogExp === true ||
    features.fogExp2 === true
  );
}

function hasStandardGenericOnlyFeature(
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
    hasStandardFogFeature(features)
  );
}

function hasAnyStandardTextureFeature(
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
    hasStandardFogFeature(features)
  );
}

function applyStandardIridescenceSampling(
  code: string,
  options: {
    readonly textureSample: string | null;
    readonly thicknessTextureSample?: string | null;
  } = { textureSample: null, thicknessTextureSample: null },
): string {
  const iridescenceFactorExpression =
    options.textureSample === null
      ? "material.iridescenceFactorIorThickness.x"
      : `material.iridescenceFactorIorThickness.x * ${options.textureSample}`;
  const iridescenceThicknessExpression =
    options.thicknessTextureSample === undefined ||
    options.thicknessTextureSample === null
      ? "material.iridescenceFactorIorThickness.w"
      : `mix(material.iridescenceFactorIorThickness.z, material.iridescenceFactorIorThickness.w, ${options.thicknessTextureSample})`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `${STANDARD_IRIDESCENCE_WGSL}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replaceAll(
      `  roughness: f32,
`,
      `  roughness: f32,
  iridescence: f32,
  iridescenceThickness: f32,
`,
    )
    .replace(
      /\n(\s*)roughness,\n/gu,
      "\n$1roughness,\n$1iridescence,\n$1iridescenceThickness,\n",
    )
    .replace(
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);`,
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let iridescenceIor = clamp(material.iridescenceFactorIorThickness.y, 1.0, 2.333);
  var fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);
  let iridescenceFresnel = standardIridescenceFresnel(
    max(dot(normal, viewDir), 0.0),
    f0,
    iridescenceThickness,
    iridescenceIor,
  );
  fresnel = mix(fresnel, iridescenceFresnel, iridescence);`,
    )
    .replace(
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(viewDir, lightDir), 0.0), f0);`,
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let iridescenceIor = clamp(material.iridescenceFactorIorThickness.y, 1.0, 2.333);
  var fresnel = fresnelSchlick(max(dot(viewDir, lightDir), 0.0), f0);
  let iridescenceFresnel = standardIridescenceFresnel(
    max(dot(normal, viewDir), 0.0),
    f0,
    iridescenceThickness,
    iridescenceIor,
  );
  fresnel = mix(fresnel, iridescenceFresnel, iridescence);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  let iridescence = clamp(${iridescenceFactorExpression}, 0.0, 1.0);
  let iridescenceThickness = clamp(${iridescenceThicknessExpression}, 0.0, 1200.0);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
  let iridescence = clamp(${iridescenceFactorExpression}, 0.0, 1.0);
  let iridescenceThickness = clamp(${iridescenceThicknessExpression}, 0.0, 1200.0);`,
    );
}

const STANDARD_IRIDESCENCE_WGSL = `
fn iridescenceIorToFresnelScalar(transmittedIor: f32, incidentIor: f32) -> f32 {
  return pow((transmittedIor - incidentIor) / (transmittedIor + incidentIor), 2.0);
}

fn iridescenceIorToFresnelVec3(transmittedIor: vec3f, incidentIor: f32) -> vec3f {
  return pow((transmittedIor - vec3f(incidentIor)) / (transmittedIor + vec3f(incidentIor)), vec3f(2.0));
}

fn iridescenceFresnelToIor(f0: vec3f) -> vec3f {
  let safeF0 = clamp(f0, vec3f(0.0001), vec3f(0.99));
  let sqrtF0 = sqrt(safeF0);
  return (vec3f(1.0) + sqrtF0) / (vec3f(1.0) - sqrtF0);
}

const IRIDESCENCE_XYZ_TO_REC709: mat3x3f = mat3x3f(
  vec3f(3.2404542, -1.5371385, -0.4985314),
  vec3f(-0.9692660, 1.8760108, 0.0415560),
  vec3f(0.0556434, -0.2040259, 1.0572252)
);

fn iridescenceSensitivity(opd: f32, shift: vec3f) -> vec3f {
  let phase = 2.0 * PI * opd * 1.0e-9;
  let primaryValue = vec3f(5.4856e-13, 4.4201e-13, 5.2481e-13);
  let primaryPosition = vec3f(1.6810e+06, 1.7953e+06, 2.2084e+06);
  let primaryVariance = vec3f(4.3278e+09, 9.3046e+09, 6.6121e+09);
  var xyz = primaryValue * sqrt(2.0 * PI * primaryVariance) *
    cos(primaryPosition * phase + shift) *
    exp(-pow(phase, 2.0) * primaryVariance);
  xyz = xyz + vec3f(
    9.7470e-14 * sqrt(2.0 * PI * 4.5282e+09) *
      cos(2.2399e+06 * phase + shift.x) *
      exp(-4.5282e+09 * pow(phase, 2.0)),
    0.0,
    0.0,
  );
  return IRIDESCENCE_XYZ_TO_REC709 * (xyz / vec3f(1.0685e-07));
}

fn iridescenceFresnelScalar(cosTheta: f32, f0: f32) -> f32 {
  let x = clamp(1.0 - cosTheta, 0.0, 1.0);
  let x2 = x * x;
  return f0 + (1.0 - f0) * x * x2 * x2;
}

fn iridescenceFresnelVec3(cosTheta: f32, f0: vec3f) -> vec3f {
  let x = clamp(1.0 - cosTheta, 0.0, 1.0);
  let x2 = x * x;
  return f0 + (vec3f(1.0) - f0) * x * x2 * x2;
}

fn standardIridescenceFresnel(cosTheta: f32, baseF0: vec3f, thickness: f32, filmIor: f32) -> vec3f {
  let outsideIor = 1.0;
  let iridescenceIor = mix(outsideIor, filmIor, smoothstep(0.0, 0.03, thickness));
  let sinTheta2Sq = pow(outsideIor / iridescenceIor, 2.0) * (1.0 - pow(cosTheta, 2.0));
  let cosTheta2Sq = 1.0 - sinTheta2Sq;

  if (cosTheta2Sq < 0.0) {
    return vec3f(1.0);
  }

  let cosTheta2 = sqrt(cosTheta2Sq);
  let r0 = iridescenceIorToFresnelScalar(iridescenceIor, outsideIor);
  let r12 = iridescenceFresnelScalar(cosTheta, r0);
  let t121 = 1.0 - r12;
  let phi12 = select(0.0, PI, iridescenceIor < outsideIor);
  let phi21 = PI - phi12;
  let baseIor = iridescenceFresnelToIor(baseF0 + vec3f(0.0001));
  let r1 = iridescenceIorToFresnelVec3(baseIor, iridescenceIor);
  let r23 = iridescenceFresnelVec3(cosTheta2, r1);
  let phi23 = select(vec3f(0.0), vec3f(PI), baseIor < vec3f(iridescenceIor));
  let opd = 2.0 * iridescenceIor * thickness * cosTheta2;
  let phi = vec3f(phi21) + phi23;
  let r123Sq = clamp(vec3f(r12) * r23, vec3f(1e-5), vec3f(0.9999));
  let r123 = sqrt(r123Sq);
  let rs = pow(vec3f(t121), vec3f(2.0)) * r23 / (vec3f(1.0) - r123Sq);
  var color = vec3f(r12) + rs;
  var coefficient = (rs - vec3f(t121)) * r123;
  color = color + coefficient * (2.0 * iridescenceSensitivity(opd, phi));
  coefficient = coefficient * r123;
  color = color + coefficient * (2.0 * iridescenceSensitivity(2.0 * opd, 2.0 * phi));
  return max(color, vec3f(0.0));
}`;

function applyStandardClearcoatSampling(
  code: string,
  options: {
    readonly textureSample: string | null;
    readonly roughnessTextureSample?: string | null;
  } = { textureSample: null, roughnessTextureSample: null },
): string {
  const clearcoatTextureFactor = options.textureSample ?? "1.0";
  const clearcoatRoughnessFactor =
    options.roughnessTextureSample === undefined ||
    options.roughnessTextureSample === null
      ? "1.0"
      : options.roughnessTextureSample;
  const withClearcoatFactor = code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {`,
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  clearcoatFactor: f32,
  clearcoatRoughness: f32,
) -> vec3f {`,
    )
    .replace(
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );`,
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
        clearcoatFactor,
        clearcoatRoughness,
      );`,
    )
    .replaceAll(
      `        roughness,
      ) * shadowFactor;`,
      `        roughness,
        clearcoatFactor,
        clearcoatRoughness,
      ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
        ) * shadowFactor;`,
      `          roughness,
          clearcoatFactor,
          clearcoatRoughness,
        ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
        );`,
      `          roughness,
          clearcoatFactor,
          clearcoatRoughness,
        );`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  let clearcoatFactor = clamp(material.clearcoatFactor * ${clearcoatTextureFactor}, 0.0, 1.0);
  let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * ${clearcoatRoughnessFactor}, 0.045, 1.0);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
  let clearcoatFactor = clamp(material.clearcoatFactor * ${clearcoatTextureFactor}, 0.0, 1.0);
  let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * ${clearcoatRoughnessFactor}, 0.045, 1.0);`,
    );

  return withClearcoatFactor.replace(
    `  var brdf = diffuse + specular;
  return brdf * radiance * nDotL;`,
    `  let clearcoatFresnel = fresnelSchlick(
    max(dot(halfVector, viewDir), 0.0),
    vec3f(0.04),
  );
  let clearcoatDistribution = distributionGGX(normal, halfVector, clearcoatRoughness);
  let clearcoatVisibility = geometrySmith(normal, viewDir, lightDir, clearcoatRoughness);
  let clearcoatSpecular = (clearcoatDistribution * clearcoatVisibility * clearcoatFresnel) /
    max(4.0 * max(dot(normal, viewDir), 0.0) * nDotL, 0.0001);
  let clearcoatAttenuation = vec3f(1.0) - clearcoatFactor * clearcoatFresnel;
  var brdf = (diffuse + specular) * clearcoatAttenuation + clearcoatSpecular * clearcoatFactor;
  return brdf * radiance * nDotL;`,
  );
}

function applyStandardSheenSampling(
  code: string,
  options: {
    readonly colorTextureSample: string | null;
    readonly roughnessTextureSample: string | null;
  },
): string {
  const sheenColorExpression =
    options.colorTextureSample === null
      ? "material.sheenColorRoughnessFactor.rgb"
      : `material.sheenColorRoughnessFactor.rgb * ${options.colorTextureSample}`;
  const sheenRoughnessExpression =
    options.roughnessTextureSample === null
      ? "material.sheenColorRoughnessFactor.a"
      : `material.sheenColorRoughnessFactor.a * ${options.roughnessTextureSample}`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,`,
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  sheenColor: vec3f,
  sheenRoughness: f32,`,
    )
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  clearcoatFactor: f32,`,
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  sheenColor: vec3f,
  sheenRoughness: f32,
  clearcoatFactor: f32,`,
    )
    .replaceAll(
      `        roughness,
      );`,
      `        roughness,
        sheenColor,
        sheenRoughness,
      );`,
    )
    .replaceAll(
      `        roughness,
        clearcoatFactor,
      );`,
      `        roughness,
        sheenColor,
        sheenRoughness,
        clearcoatFactor,
      );`,
    )
    .replaceAll(
      `        roughness,
      ) * shadowFactor;`,
      `        roughness,
        sheenColor,
        sheenRoughness,
      ) * shadowFactor;`,
    )
    .replaceAll(
      `        roughness,
        clearcoatFactor,
      ) * shadowFactor;`,
      `        roughness,
        sheenColor,
        sheenRoughness,
        clearcoatFactor,
      ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
        );`,
      `          roughness,
          sheenColor,
          sheenRoughness,
        );`,
    )
    .replaceAll(
      `          roughness,
          clearcoatFactor,
        );`,
      `          roughness,
          sheenColor,
          sheenRoughness,
          clearcoatFactor,
        );`,
    )
    .replaceAll(
      `          roughness,
        ) * shadowFactor;`,
      `          roughness,
          sheenColor,
          sheenRoughness,
        ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
          clearcoatFactor,
        ) * shadowFactor;`,
      `          roughness,
          sheenColor,
          sheenRoughness,
          clearcoatFactor,
        ) * shadowFactor;`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  let sheenColor = clamp(${sheenColorExpression}, vec3f(0.0), vec3f(1.0));
  let sheenRoughness = clamp(${sheenRoughnessExpression}, 0.045, 1.0);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
  let sheenColor = clamp(${sheenColorExpression}, vec3f(0.0), vec3f(1.0));
  let sheenRoughness = clamp(${sheenRoughnessExpression}, 0.045, 1.0);`,
    )
    .replace(
      `      direct = direct + evaluateAreaLight(
        lightIndex,
        input.worldPosition,
        normal,
        viewDir,
        baseColor,
        metallic,
        roughness,
        sheenColor,
        sheenRoughness,
      );`,
      `      direct = direct + evaluateAreaLight(
        lightIndex,
        input.worldPosition,
        normal,
        viewDir,
        baseColor,
        metallic,
        roughness,
      );`,
    )
    .replace(
      `  return brdf * radiance * nDotL;`,
      `  let sheenInvRoughness = 1.0 / max(sheenRoughness * sheenRoughness, 0.0001);
  let sheenNoH2 = pow(max(dot(normal, halfVector), 0.0), 2.0);
  let sheenSin2H = max(1.0 - sheenNoH2, 0.0078125);
  let sheenDistribution = (2.0 + sheenInvRoughness) *
    pow(sheenSin2H, sheenInvRoughness * 0.5) / (2.0 * PI);
  let sheenVisibility = 1.0 /
    max(4.0 * (max(dot(normal, viewDir), 0.000001) + nDotL -
    max(dot(normal, viewDir), 0.000001) * nDotL), 0.000001);
  let sheenSpecular = sheenDistribution * sheenVisibility * sheenColor;
  let sheenAttenuation = 1.0 - max(max(sheenColor.r, sheenColor.g), sheenColor.b) * 0.157;
  brdf = brdf * sheenAttenuation + sheenSpecular;
  return brdf * radiance * nDotL;`,
    );
}

function applyStandardTransmissionSampling(
  code: string,
  options: { readonly textureSample: string | null } = { textureSample: null },
): string {
  const transmissionTextureFactor = options.textureSample ?? "1.0";
  const fragmentStart = code.indexOf(`@fragment\nfn fs_main`);
  const withMutableFragment =
    fragmentStart < 0
      ? code
      : `${code.slice(0, fragmentStart)}${code
          .slice(fragmentStart)
          .replace(`  let alpha = `, `  var alpha = `)
          .replace(
            `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
            `  var color = ambientDiffuse + direct + material.emissiveFactor;`,
          )
          .replace(
            `  let color = ambientDiffuse + direct + emissive;`,
            `  var color = ambientDiffuse + direct + emissive;`,
          )}`;

  return withMutableFragment.replace(
    `  return vec4f(color, alpha);`,
    `  let transmission = clamp(material.transmissionFactor * ${transmissionTextureFactor}, 0.0, 1.0);
  let sceneColorSize = vec2f(textureDimensions(standardTransmissionSceneColorTexture));
  let sceneColorUv = clamp(input.position.xy / max(sceneColorSize, vec2f(1.0)), vec2f(0.0), vec2f(1.0));
  let refractionOffset = clamp(normal.xy * transmission * (0.045 + roughness * 0.02), vec2f(-0.08), vec2f(0.08));
  let transmissionUv = clamp(sceneColorUv + refractionOffset, vec2f(0.0), vec2f(1.0));
  let transmissionRoughness = clamp(roughness, 0.0, 1.0);
  let transmissionBlurRadiusPixels = transmissionRoughness * transmissionRoughness * 42.0;
  let transmissionBlurTexel = transmissionBlurRadiusPixels / max(sceneColorSize, vec2f(1.0));
  let transmissionSharpColor = textureSampleLevel(
    standardTransmissionSceneColorTexture,
    standardTransmissionSceneColorSampler,
    transmissionUv,
    0.0,
  ).rgb;
  let transmissionBlurColor = (
    transmissionSharpColor * 0.24 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(transmissionBlurTexel.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv - vec2f(transmissionBlurTexel.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(0.0, transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv - vec2f(0.0, transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + transmissionBlurTexel, vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv - transmissionBlurTexel, vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(transmissionBlurTexel.x, -transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(-transmissionBlurTexel.x, transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07
  );
  let transmittedSceneColor = mix(
    transmissionSharpColor,
    transmissionBlurColor,
    smoothstep(0.08, 0.85, transmissionRoughness),
  );
  color = mix(color, transmittedSceneColor * max(baseColor, vec3f(0.04)), transmission);
  alpha = alpha * max(1.0 - transmission * 0.25, 0.72);
  return vec4f(color, alpha);`,
  );
}

function applyStandardFogSampling(
  code: string,
  features: StandardTextureShaderFeatures,
): string {
  const fogFactor =
    features.fogLinear === true
      ? `  let fogFactor = 1.0 - saturate((view.fogParams.w - distanceToCamera) / max(view.fogParams.w - view.fogParams.z, 0.0001));`
      : features.fogExp === true
        ? `  let fogFactor = 1.0 - saturate(exp(-distanceToCamera * view.fogParams.y));`
        : `  let fogFactor = 1.0 - saturate(exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y));`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `fn applyDistanceFog(color: vec3f, distanceToCamera: f32) -> vec3f {
${fogFactor}
  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  var color = ambientDiffuse + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + emissive;`,
      `  var color = ambientDiffuse + direct + emissive;`,
    )
    .replace(
      `  return vec4f(color, alpha);`,
      `  color = applyDistanceFog(color, length(view.cameraPosition.xyz - input.worldPosition));
  return vec4f(color, alpha);`,
    );
}

function applyStandardClusteredLocalLightSampling(code: string): string {
  return code
    .replace(
      `@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {`,
      `fn localLightClusterEnabled() -> bool {
  return arrayLength(&localLightClusterParams) >= 12u && localLightClusterParams[11] > 0.5;
}

fn localLightClusterDimensions() -> vec3u {
  return max(
    vec3u(
      u32(max(localLightClusterParams[8], 1.0)),
      u32(max(localLightClusterParams[9], 1.0)),
      u32(max(localLightClusterParams[10], 1.0)),
    ),
    vec3u(1u),
  );
}

fn localLightClusterInvalidCell() -> u32 {
  return 4294967295u;
}

fn localLightClusterCellIndex(position: vec3f) -> u32 {
  if (!localLightClusterEnabled()) {
    return localLightClusterInvalidCell();
  }

  let minBounds = vec3f(
    localLightClusterParams[0],
    localLightClusterParams[1],
    localLightClusterParams[2],
  );
  let invCellSize = vec3f(
    localLightClusterParams[4],
    localLightClusterParams[5],
    localLightClusterParams[6],
  );
  let dimensions = localLightClusterDimensions();
  let clusterPosition = (position - minBounds) * invCellSize;

  if (
    clusterPosition.x < 0.0 ||
    clusterPosition.y < 0.0 ||
    clusterPosition.z < 0.0 ||
    clusterPosition.x >= f32(dimensions.x) ||
    clusterPosition.y >= f32(dimensions.y) ||
    clusterPosition.z >= f32(dimensions.z)
  ) {
    return localLightClusterInvalidCell();
  }

  let x = min(u32(clusterPosition.x), dimensions.x - 1u);
  let y = min(u32(clusterPosition.y), dimensions.y - 1u);
  let z = min(u32(clusterPosition.z), dimensions.z - 1u);
  return x + y * dimensions.x + z * dimensions.x * dimensions.y;
}

fn evaluateClusteredLocalLights(
  position: vec3f,
  normal: vec3f,
  viewDir: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let cellIndex = localLightClusterCellIndex(position);

  if (cellIndex == localLightClusterInvalidCell()) {
    return vec3f(0.0);
  }

  let cellOffset = cellIndex * 2u;

  if (cellOffset + 1u >= arrayLength(&localLightClusterCells)) {
    return vec3f(0.0);
  }

  let lightOffset = localLightClusterCells[cellOffset];
  let localLightCount = localLightClusterCells[cellOffset + 1u];
  var clusteredDirect = vec3f(0.0);

  for (
    var itemIndex = 0u;
    itemIndex < localLightCount && lightOffset + itemIndex < arrayLength(&localLightClusterIndices);
    itemIndex = itemIndex + 1u
  ) {
    let lightIndex = localLightClusterIndices[lightOffset + itemIndex];

    if (lightIndex < lightCount()) {
      let kind = lightKind(lightIndex);

      if (kind == LIGHT_KIND_POINT) {
        let lightPosition = pointLightPosition(lightIndex);
        let toLight = lightPosition - position;
        let lightDistance = length(toLight);
        let lightRange = pointLightRange(lightIndex);
        let attenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

        if (attenuation > 0.0 && lightDistance > 0.0001) {
          clusteredDirect = clusteredDirect + evaluateDirectLight(
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
        let toLight = lightPosition - position;
        let lightDistance = length(toLight);
        let lightRange = pointLightRange(lightIndex);
        let rangeAttenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

        if (rangeAttenuation > 0.0 && lightDistance > 0.0001) {
          let lightDir = toLight / lightDistance;
          let coneAttenuation = spotLightConeAttenuation(lightIndex, -lightDir);
          clusteredDirect = clusteredDirect + evaluateDirectLight(
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
    }
  }

  return clusteredDirect;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {`,
    )
    .replace(
      `  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
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
  }`,
      `  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
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

  direct = direct + evaluateClusteredLocalLights(
    input.worldPosition,
    normal,
    viewDir,
    baseColor,
    metallic,
    roughness,
  );`,
    );
}

function applyStandardShadowMapSampling(
  code: string,
  options: { readonly cascaded?: boolean } = {},
): string {
  const helpers =
    options.cascaded === true
      ? `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.002;
const STANDARD_SHADOW_MAX_CASCADES: u32 = 4u;

fn directionalShadowCascadeCount(lightIndex: u32) -> u32 {
  let offset = lightFloatOffset(lightIndex);
  return min(
    min(u32(max(lightFloats[offset + 5u], 0.0)), STANDARD_SHADOW_MAX_CASCADES),
    arrayLength(&directionalShadowMatrices),
  );
}

fn directionalShadowCascadeFarBound(lightIndex: u32, cascadeIndex: u32) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  return lightFloats[offset + 6u + cascadeIndex];
}

fn directionalShadowMatrixBaseIndex(lightIndex: u32) -> u32 {
  let offset = lightFloatOffset(lightIndex);
  return u32(max(lightFloats[offset + 10u], 0.0));
}

fn selectDirectionalShadowCascade(lightIndex: u32, worldPosition: vec3f) -> u32 {
  let cascadeCount = directionalShadowCascadeCount(lightIndex);
  let viewDistance = distance(view.cameraPosition.xyz, worldPosition);

  for (var cascadeIndex = 0u; cascadeIndex < STANDARD_SHADOW_MAX_CASCADES; cascadeIndex = cascadeIndex + 1u) {
    if (cascadeIndex >= cascadeCount) {
      return cascadeCount;
    }

    if (viewDistance <= directionalShadowCascadeFarBound(lightIndex, cascadeIndex)) {
      return cascadeIndex;
    }
  }

  return cascadeCount;
}

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32, cascadeIndex: u32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        directionalShadowMap,
        directionalShadowSampler,
        sampleUv,
        i32(cascadeIndex),
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowFactor(lightIndex: u32, worldPosition: vec3f) -> f32 {
  let cascadeIndex = selectDirectionalShadowCascade(lightIndex, worldPosition);
  let cascadeCount = directionalShadowCascadeCount(lightIndex);

  if (cascadeIndex >= cascadeCount) {
    return 1.0;
  }

  let matrixIndex = directionalShadowMatrixBaseIndex(lightIndex) + cascadeIndex;

  if (matrixIndex >= arrayLength(&directionalShadowMatrices)) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[matrixIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
  let shadowUv = vec2f(shadowClip.x * 0.5 + 0.5, 0.5 - shadowClip.y * 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let projectionDistance = max(
    distance(shadowUv, clampedShadowUv),
    abs(shadowDepth - clampedShadowDepth),
  );

  if (projectionDistance > 0.0) {
    return 1.0;
  }

  let receiverDepth = clamp(
    clampedShadowDepth - STANDARD_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = sampleDirectionalShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
    cascadeIndex,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);
}

fn sampleDirectionalShadowReceiverFactor(worldPosition: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_DIRECTIONAL) {
      factor = min(factor, sampleDirectionalShadowFactor(lightIndex, worldPosition));
    }
  }

  return factor;
}`
      : `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.002;

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        directionalShadowMap,
        directionalShadowSampler,
        sampleUv,
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowFactor(worldPosition: vec3f) -> f32 {
  if (arrayLength(&directionalShadowMatrices) == 0u) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[0] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
  let shadowUv = vec2f(shadowClip.x * 0.5 + 0.5, 0.5 - shadowClip.y * 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let projectionDistance = max(
    distance(shadowUv, clampedShadowUv),
    abs(shadowDepth - clampedShadowDepth),
  );

  if (projectionDistance > 0.0) {
    return 1.0;
  }

  let receiverDepth = clamp(
    clampedShadowDepth - STANDARD_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = sampleDirectionalShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  let compareFactor = mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);

  return compareFactor;
}`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `${helpers}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );`,
      options.cascaded === true
        ? `      let shadowFactor = sampleDirectionalShadowFactor(lightIndex, input.worldPosition);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`
        : `      let shadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      options.cascaded === true
        ? `  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`
        : `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}

function applyStandardPointShadowMapSampling(code: string): string {
  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `const STANDARD_POINT_SHADOW_MIN_VISIBILITY: f32 = 0.5;
const STANDARD_POINT_SHADOW_DEPTH_BIAS: f32 = 0.0001;

fn pointShadowFaceIndex(toReceiver: vec3f) -> u32 {
  let absDirection = abs(toReceiver);

  if (absDirection.x >= absDirection.y && absDirection.x >= absDirection.z) {
    return select(1u, 0u, toReceiver.x >= 0.0);
  }

  if (absDirection.y >= absDirection.x && absDirection.y >= absDirection.z) {
    return select(3u, 2u, toReceiver.y >= 0.0);
  }

  return select(5u, 4u, toReceiver.z >= 0.0);
}

fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32 {
  if (arrayLength(&pointShadowMatrices) < 6u) {
    return 1.0;
  }

  let toReceiver = worldPosition - lightPosition;
  let receiverDistance = length(toReceiver);

  if (receiverDistance <= 0.0001) {
    return 1.0;
  }

  let faceIndex = pointShadowFaceIndex(toReceiver);
  let shadowPosition = pointShadowMatrices[faceIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );

  if (abs(shadowClip.x) > 1.0 || abs(shadowClip.y) > 1.0 || shadowDepth < 0.0 || shadowDepth > 1.0) {
    return 1.0;
  }

  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let receiverDepth = clamp(
    clampedShadowDepth - STANDARD_POINT_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = textureSampleCompareLevel(
    pointShadowMap,
    pointShadowSampler,
    normalize(toReceiver),
    receiverDepth,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_POINT_SHADOW_MIN_VISIBILITY, 1.0, visibility);
}

fn samplePointShadowReceiverFactor(worldPosition: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_POINT) {
      factor = min(
        factor,
        samplePointShadowFactor(worldPosition, pointLightPosition(lightIndex)),
      );
    }
  }

  return factor;
}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        );`,
      `        let shadowFactor = samplePointShadowFactor(input.worldPosition, lightPosition);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        ) * shadowFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  let receiverPointShadowFactor = samplePointShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverPointShadowFactor + material.emissiveFactor;`,
    );
}

function applyStandardMultiShadowMapSampling(code: string): string {
  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.002;
const STANDARD_POINT_SHADOW_MIN_VISIBILITY: f32 = 0.5;
const STANDARD_POINT_SHADOW_DEPTH_BIAS: f32 = 0.0001;

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        directionalShadowMap,
        directionalShadowSampler,
        sampleUv,
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleSpotShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32) -> f32 {
  let shadowDimensions = textureDimensions(spotShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        spotShadowMap,
        spotShadowSampler,
        sampleUv,
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowFactor(worldPosition: vec3f) -> f32 {
  if (arrayLength(&directionalShadowMatrices) == 0u) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[0] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
  let shadowUv = vec2f(shadowClip.x * 0.5 + 0.5, 0.5 - shadowClip.y * 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let projectionDistance = max(
    distance(shadowUv, clampedShadowUv),
    abs(shadowDepth - clampedShadowDepth),
  );

  if (projectionDistance > 0.0) {
    return 1.0;
  }

  let receiverDepth = clamp(
    clampedShadowDepth - STANDARD_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = sampleDirectionalShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);
}

fn sampleSpotShadowFactor(worldPosition: vec3f) -> f32 {
  if (arrayLength(&spotShadowMatrices) == 0u) {
    return 1.0;
  }

  let shadowPosition = spotShadowMatrices[0] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
  let shadowUv = vec2f(shadowClip.x * 0.5 + 0.5, 0.5 - shadowClip.y * 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let projectionDistance = max(
    distance(shadowUv, clampedShadowUv),
    abs(shadowDepth - clampedShadowDepth),
  );

  if (projectionDistance > 0.0) {
    return 1.0;
  }

  let receiverDepth = clamp(
    clampedShadowDepth - STANDARD_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = sampleSpotShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);
}

fn pointShadowFaceIndex(toReceiver: vec3f) -> u32 {
  let absDirection = abs(toReceiver);

  if (absDirection.x >= absDirection.y && absDirection.x >= absDirection.z) {
    return select(1u, 0u, toReceiver.x >= 0.0);
  }

  if (absDirection.y >= absDirection.x && absDirection.y >= absDirection.z) {
    return select(3u, 2u, toReceiver.y >= 0.0);
  }

  return select(5u, 4u, toReceiver.z >= 0.0);
}

fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32 {
  if (arrayLength(&pointShadowMatrices) < 6u) {
    return 1.0;
  }

  let toReceiver = worldPosition - lightPosition;
  let receiverDistance = length(toReceiver);

  if (receiverDistance <= 0.0001) {
    return 1.0;
  }

  let faceIndex = pointShadowFaceIndex(toReceiver);
  let shadowPosition = pointShadowMatrices[faceIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );

  if (abs(shadowClip.x) > 1.0 || abs(shadowClip.y) > 1.0 || shadowDepth < 0.0 || shadowDepth > 1.0) {
    return 1.0;
  }

  let receiverDepth = clamp(
    clamp(shadowDepth, 0.0, 1.0) - STANDARD_POINT_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = textureSampleCompareLevel(
    pointShadowMap,
    pointShadowSampler,
    normalize(toReceiver),
    receiverDepth,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_POINT_SHADOW_MIN_VISIBILITY, 1.0, visibility);
}

fn samplePointShadowReceiverFactor(worldPosition: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_POINT) {
      factor = min(
        factor,
        samplePointShadowFactor(worldPosition, pointLightPosition(lightIndex)),
      );
    }
  }

  return factor;
}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );`,
      `      let shadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`,
    )
    .replace(
      `        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        );`,
      `        let shadowFactor = samplePointShadowFactor(input.worldPosition, lightPosition);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        ) * shadowFactor;`,
    )
    .replace(
      `        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          lightDir,
          lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
          baseColor,
          metallic,
          roughness,
        );`,
      `        let shadowFactor = sampleSpotShadowFactor(input.worldPosition);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          lightDir,
          lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
          baseColor,
          metallic,
          roughness,
        ) * shadowFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  let receiverShadowFactor = min(
    min(
      sampleDirectionalShadowFactor(input.worldPosition),
      sampleSpotShadowFactor(input.worldPosition),
    ),
    samplePointShadowReceiverFactor(input.worldPosition),
  );
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}

function applyStandardDiffuseIblSampling(code: string): string {
  const sample = `  let diffuseIbl = textureSample(
    standardDiffuseIblTexture,
    standardIblSampler,
    normal,
  ).rgb * baseColor * (1.0 - metallic);`;

  return code
    .replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `${sample}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
  let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * occlusion;
  let color = ambientDiffuse + direct + emissive;`,
      `${sample}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * occlusion;
  let color = ambientDiffuse + diffuseIbl + direct + emissive;`,
    )
    .replace(
      `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}

function applyStandardSpecularIblProofSampling(code: string): string {
  const sample = `  let reflectionDir = reflect(-viewDir, normal);
  let specularMipLevel = f32(max(textureNumLevels(standardSpecularIblTexture), 1u) - 1u) * roughness;
  let specularIblProof = textureSampleLevel(
    standardSpecularIblTexture,
    standardIblSampler,
    reflectionDir,
    specularMipLevel,
  ).rgb * fresnelSchlick(max(dot(normal, viewDir), 0.0), mix(vec3f(0.04), baseColor, vec3f(metallic))) * (1.0 - roughness * 0.5);`;

  return code
    .replace(
      `  let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;`,
      `${sample}
  let color = ambientDiffuse + diffuseIbl + specularIblProof + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + diffuseIbl + direct + emissive;`,
      `${sample}
  let color = ambientDiffuse + diffuseIbl + specularIblProof + direct + emissive;`,
    )
    .replace(
      `  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let color = (ambientDiffuse + diffuseIbl + specularIblProof + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}
