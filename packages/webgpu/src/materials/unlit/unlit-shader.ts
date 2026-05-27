import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
import { LIGHT_SHADER_BINDING_METADATA } from "../../lighting/light-shader-metadata.js";

export type BuiltInShaderBindingResource =
  | "uniform-buffer"
  | "read-only-storage-buffer"
  | "texture"
  | "sampler";

export type BuiltInShaderBindingId =
  | "viewProjection"
  | "worldTransforms"
  | "previousWorldTransforms"
  | "unlitMaterial"
  | "matcapMaterial"
  | "standardMaterial"
  | "debugNormalMaterial"
  | "lightFloats"
  | "lightMetadata"
  | "localLightClusterParams"
  | "localLightClusterCells"
  | "localLightClusterIndices"
  | "localLightClusterMetadata"
  | "localLightClusterCookieTexture"
  | "localLightClusterCookieSampler"
  | "localLightClusterCookieMatrices"
  | "baseColorTexture"
  | "baseColorSampler"
  | "metallicRoughnessTexture"
  | "metallicRoughnessSampler"
  | "clearcoatTexture"
  | "clearcoatSampler"
  | "clearcoatRoughnessTexture"
  | "clearcoatRoughnessSampler"
  | "transmissionTexture"
  | "transmissionSampler"
  | "sheenColorTexture"
  | "sheenColorSampler"
  | "sheenRoughnessTexture"
  | "sheenRoughnessSampler"
  | "iridescenceTexture"
  | "iridescenceSampler"
  | "iridescenceThicknessTexture"
  | "iridescenceThicknessSampler"
  | "normalTexture"
  | "normalSampler"
  | "occlusionTexture"
  | "occlusionSampler"
  | "emissiveTexture"
  | "emissiveSampler"
  | "directionalShadowMatrices"
  | "directionalShadowMap"
  | "directionalShadowSampler"
  | "standardDiffuseIblTexture"
  | "standardSpecularIblTexture"
  | "standardIblSampler"
  | "standardTransmissionSceneColorTexture"
  | "standardTransmissionSceneColorSampler"
  | "skinJointMatrices"
  | "standardMorphTargetWeights"
  | "matcapTexture"
  | "matcapSampler";

export interface BuiltInShaderBindingMetadata {
  readonly id: BuiltInShaderBindingId;
  readonly label: string;
  readonly group: number;
  readonly binding: number;
  readonly resource: BuiltInShaderBindingResource;
}

export interface BuiltInShaderEntryPoints {
  readonly vertex: string;
  readonly fragment: string;
}

export interface BuiltInShaderSourceModule {
  readonly label: string;
  readonly code: string;
  readonly entryPoints: BuiltInShaderEntryPoints;
  readonly bindings: readonly BuiltInShaderBindingMetadata[];
}

export type BuiltInShaderMetadataDiagnosticCode =
  | "shaderMetadata.missingLabel"
  | "shaderMetadata.missingCode"
  | "shaderMetadata.missingEntryPoint"
  | "shaderMetadata.missingBinding";

export interface BuiltInShaderMetadataDiagnostic {
  readonly code: BuiltInShaderMetadataDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface BuiltInShaderMetadataValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly BuiltInShaderMetadataDiagnostic[];
}

export const UNLIT_MESH_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct UnlitMaterialUniform {
  baseColorFactor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: UnlitMaterialUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  _ = input;
  return material.baseColorFactor;
}
`.trim();

export const UNLIT_TEXTURED_MESH_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct UnlitMaterialUniform {
  baseColorFactor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: UnlitMaterialUniform;
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;
@group(2) @binding(2) var baseColorSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(baseColorTexture, baseColorSampler, input.uv) * material.baseColorFactor;
}
`.trim();

export const UNLIT_VERTEX_COLOR_MESH_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct UnlitMaterialUniform {
  baseColorFactor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(5) color: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: UnlitMaterialUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color * material.baseColorFactor;
}
`.trim();

export const UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct UnlitMaterialUniform {
  baseColorFactor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(5) color: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: UnlitMaterialUniform;
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;
@group(2) @binding(2) var baseColorSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(baseColorTexture, baseColorSampler, input.uv) * input.color * material.baseColorFactor;
}
`.trim();

export const UNLIT_MESH_SHADER: BuiltInShaderSourceModule = {
  label: "aperture/unlit-mesh",
  code: UNLIT_MESH_WGSL,
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
      id: "unlitMaterial",
      label: "Unlit material uniform",
      group: 2,
      binding: 0,
      resource: "uniform-buffer",
    },
  ],
};

export const UNLIT_VERTEX_COLOR_MESH_SHADER: BuiltInShaderSourceModule = {
  label: "aperture/unlit-mesh-vertex-color",
  code: UNLIT_VERTEX_COLOR_MESH_WGSL,
  entryPoints: UNLIT_MESH_SHADER.entryPoints,
  bindings: UNLIT_MESH_SHADER.bindings,
};

export const UNLIT_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule = {
  label: "aperture/unlit-mesh-textured",
  code: UNLIT_TEXTURED_MESH_WGSL,
  entryPoints: {
    vertex: "vs_main",
    fragment: "fs_main",
  },
  bindings: [
    ...UNLIT_MESH_SHADER.bindings,
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

export const UNLIT_TEXTURED_VERTEX_COLOR_MESH_SHADER: BuiltInShaderSourceModule =
  {
    label: "aperture/unlit-mesh-textured-vertex-color",
    code: UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL,
    entryPoints: UNLIT_TEXTURED_MESH_SHADER.entryPoints,
    bindings: UNLIT_TEXTURED_MESH_SHADER.bindings,
  };

export const UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER: BuiltInShaderSourceModule =
  {
    label: "aperture/unlit-mesh-light-bindings-metadata",
    code: UNLIT_MESH_WGSL,
    entryPoints: UNLIT_MESH_SHADER.entryPoints,
    bindings: [
      ...UNLIT_MESH_SHADER.bindings,
      ...LIGHT_SHADER_BINDING_METADATA.bindings.map((binding) => ({
        id: binding.id,
        label: binding.label,
        group: binding.group,
        binding: binding.binding,
        resource: binding.resource,
      })),
    ],
  };

export function createUnlitMeshShaderModuleDescriptor(
  shader: BuiltInShaderSourceModule = UNLIT_MESH_SHADER,
): WebGpuShaderModuleDescriptor {
  return {
    label: shader.label,
    code: shader.code,
    entryPoints: [shader.entryPoints.vertex, shader.entryPoints.fragment],
  };
}

export function validateBuiltInShaderMetadata(
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
    "unlitMaterial",
  ] satisfies readonly BuiltInShaderBindingId[]) {
    if (!shader.bindings.some((binding) => binding.id === id)) {
      diagnostics.push({
        code: "shaderMetadata.missingBinding",
        field: `bindings.${id}`,
        message: `Built-in shader metadata is missing '${id}' binding metadata.`,
      });
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}
