import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
import type {
  BuiltInShaderBindingId,
  BuiltInShaderBindingMetadata,
  BuiltInShaderMetadataDiagnostic,
  BuiltInShaderMetadataValidationReport,
  BuiltInShaderSourceModule,
} from "../unlit/unlit-shader.js";

export const DEBUG_NORMAL_SHADER_VARIANT = "world-normal-rgb";

export const DEBUG_NORMAL_MESH_WGSL = `
// DebugNormalMaterial metadata shader.
// This contract visualizes world-space vertex normals as RGB color. Frame
// resources, bind groups, and app activation are intentionally deferred.
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct DebugNormalMaterialUniform {
  mode: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldNormal: vec3f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: DebugNormalMaterialUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  _ = material;

  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let encodedNormal = normalize(input.worldNormal) * 0.5 + vec3f(0.5);
  return vec4f(encodedNormal, 1.0);
}
`.trim();

export const DEBUG_NORMAL_MESH_SHADER: BuiltInShaderSourceModule = {
  label: "aperture/debug-normal-mesh",
  code: DEBUG_NORMAL_MESH_WGSL,
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
      id: "debugNormalMaterial",
      label: "Debug normal material uniform",
      group: 2,
      binding: 0,
      resource: "uniform-buffer",
    },
  ],
};

export function createDebugNormalMeshShaderModuleDescriptor(
  shader: BuiltInShaderSourceModule = DEBUG_NORMAL_MESH_SHADER,
): WebGpuShaderModuleDescriptor {
  return {
    label: shader.label,
    code: shader.code,
    entryPoints: [shader.entryPoints.vertex, shader.entryPoints.fragment],
  };
}

export function validateDebugNormalShaderMetadata(
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
    "debugNormalMaterial",
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
