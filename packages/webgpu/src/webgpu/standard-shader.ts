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

export const STANDARD_MATERIAL_MVP_LIGHTING_MODEL = {
  variant: STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
  brdf: "Cook-Torrance GGX direct lighting with Schlick Fresnel and Lambert diffuse.",
  supported: [
    "baseColorFactor",
    "baseColorTexture",
    "metallicFactor",
    "roughnessFactor",
    "emissiveFactor",
    "ambientLight",
    "directionalLight",
  ],
  deferred: [
    "metallicRoughnessTexture",
    "normalMaps",
    "imageBasedLighting",
    "shadows",
  ],
} as const;

export const STANDARD_MESH_WGSL = `
// StandardMaterial MVP shader.
// Direct lights use a small metallic/roughness GGX BRDF. Texture sampling,
// normal maps, image-based lighting, and shadows are deferred.
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
  padding0: f32,
  padding1: f32,
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
  STANDARD_MESH_WGSL.replace(
    `// Direct lights use a small metallic/roughness GGX BRDF. Texture sampling,
// normal maps, image-based lighting, and shadows are deferred.`,
    `// Direct lights use a small metallic/roughness GGX BRDF. Base-color texture
// sampling is active; normal maps, image-based lighting, and shadows are deferred.`,
  )
    .replace(
      `@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;
@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;`,
      `@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;
@group(2) @binding(2) var baseColorSampler: sampler;
@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;`,
    )
    .replace(
      `  let baseColor = material.baseColorFactor.rgb;
  let alpha = material.baseColorFactor.a;`,
      `  let baseColorSample = textureSample(baseColorTexture, baseColorSampler, input.uv);
  let baseColor = baseColorSample.rgb * material.baseColorFactor.rgb;
  let alpha = baseColorSample.a * material.baseColorFactor.a;`,
    );

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
  {
    label: "aperture/standard-mesh-base-color-textured",
    code: STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL,
    entryPoints: STANDARD_MESH_SHADER.entryPoints,
    bindings: [
      ...STANDARD_MESH_SHADER.bindings,
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
    ],
  };

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
