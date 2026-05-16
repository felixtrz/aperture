import type { WebGpuShaderModuleDescriptor } from "./shader.js";
import type {
  BuiltInShaderBindingId,
  BuiltInShaderBindingMetadata,
  BuiltInShaderMetadataDiagnostic,
  BuiltInShaderMetadataValidationReport,
  BuiltInShaderSourceModule,
} from "./unlit-shader.js";

export const MATCAP_MATERIAL_SHADER_VARIANT = "matcap-texture";

export const MATCAP_MESH_WGSL = `
// MatcapMaterial metadata shader.
// This is a contract-only shader source until the app facade has an active
// matcap pipeline, material buffer, texture, sampler, and bind group path.
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct MatcapMaterialUniform {
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
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: MatcapMaterialUniform;
@group(2) @binding(1) var matcapTexture: texture_2d<f32>;
@group(2) @binding(2) var matcapSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  let worldPosition = world * vec4f(input.position, 1.0);
  output.position = view.viewProjection * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  let tangentX = normalize(vec3f(viewDir.z, 0.0, -viewDir.x));
  let tangentY = cross(viewDir, tangentX);
  let matcapUv = vec2f(dot(tangentX, normal), dot(tangentY, normal)) * 0.495 + vec2f(0.5);
  let matcapColor = textureSample(matcapTexture, matcapSampler, matcapUv);
  return vec4f(
    material.baseColorFactor.rgb * matcapColor.rgb,
    material.baseColorFactor.a * matcapColor.a,
  );
}
`.trim();

export const MATCAP_MESH_SHADER: BuiltInShaderSourceModule = {
  label: "aperture/matcap-mesh",
  code: MATCAP_MESH_WGSL,
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
      id: "matcapMaterial",
      label: "Matcap material uniform",
      group: 2,
      binding: 0,
      resource: "uniform-buffer",
    },
    {
      id: "matcapTexture",
      label: "Matcap texture",
      group: 2,
      binding: 1,
      resource: "texture",
    },
    {
      id: "matcapSampler",
      label: "Matcap sampler",
      group: 2,
      binding: 2,
      resource: "sampler",
    },
  ],
};

export function createMatcapMeshShaderModuleDescriptor(
  shader: BuiltInShaderSourceModule = MATCAP_MESH_SHADER,
): WebGpuShaderModuleDescriptor {
  return {
    label: shader.label,
    code: shader.code,
    entryPoints: [shader.entryPoints.vertex, shader.entryPoints.fragment],
  };
}

export function validateMatcapShaderMetadata(
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
    "matcapMaterial",
    "matcapTexture",
    "matcapSampler",
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
