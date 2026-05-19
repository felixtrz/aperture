import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedLightKindId,
} from "./light-packing.js";
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
export const STANDARD_DIFFUSE_IBL_SHADER_VARIANT =
  "direct-lit-metallic-roughness-diffuse-ibl";
export const STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT =
  "direct-lit-metallic-roughness-diffuse-specular-ibl-proof";

export interface StandardTextureShaderFeatures {
  readonly baseColorTexture: boolean;
  readonly metallicRoughnessTexture: boolean;
  readonly normalTexture: boolean;
  readonly occlusionTexture: boolean;
  readonly emissiveTexture: boolean;
  readonly shadowMap?: boolean;
  readonly iblDiffuse?: boolean;
  readonly iblSpecularProof?: boolean;
  readonly texCoord1?: boolean;
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
  padding6: f32,
  padding7: f32,
  padding8: f32,
  padding9: f32,
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
const STANDARD_FEATURE_ALPHA_MASK: u32 = 32u;

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;
@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;
@group(3) @binding(1) var<storage, read> lightMetadata: array<i32>;

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
  return (diffuse + specular) * radiance * nDotL;
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
    features.texCoord1 !== true
  ) {
    return STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT;
  }

  if (
    features.shadowMap === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true
  ) {
    return STANDARD_SHADOW_MAP_SHADER_VARIANT;
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof !== true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.texCoord1 !== true
  ) {
    return STANDARD_DIFFUSE_IBL_SHADER_VARIANT;
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.texCoord1 !== true
  ) {
    return STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT;
  }

  const names: string[] = [];

  if (features.baseColorTexture) {
    names.push("base-color");
  }

  if (features.metallicRoughnessTexture) {
    names.push("metallic-roughness");
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

  if (features.iblDiffuse === true) {
    names.push("diffuse-ibl");
  }

  if (features.iblSpecularProof === true) {
    names.push("specular-ibl-proof");
  }

  if (features.texCoord1 === true) {
    names.push("uv1");
  }

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

  if (features.shadowMap === true) {
    code = applyStandardShadowMapSampling(code);
  }

  if (features.iblDiffuse === true) {
    code = applyStandardDiffuseIblSampling(code);
  }

  if (features.iblSpecularProof === true) {
    code = applyStandardSpecularIblProofSampling(code);
  }

  return code;
}

function standardTextureVariantComment(
  features: StandardTextureShaderFeatures,
): string {
  const active = standardTextureFeatureNames(features);

  const deferred =
    features.shadowMap === true
      ? "image-based lighting is"
      : "image-based lighting and shadows are";

  return `// Direct lights use a small metallic/roughness GGX BRDF. ${active.join(
    ", ",
  )} sampling is active; ${deferred} deferred.`;
}

function standardTextureUvExpression(
  features: StandardTextureShaderFeatures,
  field:
    | "baseColor"
    | "metallicRoughness"
    | "normal"
    | "occlusion"
    | "emissive",
): string {
  if (features.texCoord1 !== true) {
    return "input.uv";
  }

  return `standardTextureUv(material.${field}TexCoord, input.uv, input.uv1)`;
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
    declarations.push(
      "@group(3) @binding(2) var<storage, read> directionalShadowMatrices: array<mat4x4f>;",
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d;",
      "@group(3) @binding(4) var directionalShadowSampler: sampler_comparison;",
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

  return bindings;
}

function standardTextureVariantShaderLabel(
  features: StandardTextureShaderFeatures,
): string {
  if (
    features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true
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
    features.iblDiffuse !== true &&
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true
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
    features.iblSpecularProof !== true &&
    features.texCoord1 !== true
  ) {
    return "aperture/standard-mesh-base-color-metallic-roughness-textured";
  }

  if (
    features.shadowMap === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.iblDiffuse !== true &&
    features.texCoord1 !== true
  ) {
    return "aperture/standard-mesh-shadow-receiver";
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof !== true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.texCoord1 !== true
  ) {
    return "aperture/standard-mesh-diffuse-ibl";
  }

  if (
    features.iblDiffuse === true &&
    features.iblSpecularProof === true &&
    !features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture &&
    features.shadowMap !== true &&
    features.texCoord1 !== true
  ) {
    return "aperture/standard-mesh-diffuse-specular-ibl-proof";
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

  if (features.iblDiffuse === true) {
    names.push("diffuse-ibl");
  }

  if (features.iblSpecularProof === true) {
    names.push("specular-ibl-proof");
  }

  if (features.texCoord1 === true) {
    names.push("uv1");
  }

  return names;
}

function hasAnyStandardTextureFeature(
  features: StandardTextureShaderFeatures,
): boolean {
  return (
    features.baseColorTexture ||
    features.metallicRoughnessTexture ||
    features.normalTexture ||
    features.occlusionTexture ||
    features.emissiveTexture ||
    features.shadowMap === true ||
    features.iblDiffuse === true ||
    features.iblSpecularProof === true ||
    features.texCoord1 === true
  );
}

function applyStandardShadowMapSampling(code: string): string {
  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
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
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
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
