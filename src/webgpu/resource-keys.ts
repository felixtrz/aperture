export type WebGpuResourceKeyKind =
  | "mesh-buffer"
  | "mesh-vertex-buffer"
  | "mesh-index-buffer"
  | "material-buffer"
  | "view-uniform-buffer"
  | "shader-module"
  | "render-pipeline"
  | "bind-group"
  | "command-encoder"
  | "command-buffer";

export function webGpuResourceKey(
  kind: WebGpuResourceKeyKind,
  id: string,
): string {
  const normalized = id.trim();

  if (normalized.length === 0) {
    throw new RangeError(`Cannot create '${kind}' resource key with empty id.`);
  }

  return `${kind}:${normalized}`;
}

export function meshBufferResourceKey(meshLabel: string): string {
  return webGpuResourceKey("mesh-buffer", meshLabel);
}

export function meshVertexBufferResourceKey(
  meshLabel: string,
  streamId: string,
): string {
  return webGpuResourceKey(
    "mesh-vertex-buffer",
    `${meshLabel}/vertex:${streamId}`,
  );
}

export function meshIndexBufferResourceKey(meshLabel: string): string {
  return webGpuResourceKey("mesh-index-buffer", `${meshLabel}/index`);
}

export function materialUniformBufferResourceKey(label: string): string {
  return webGpuResourceKey("material-buffer", label);
}

export function viewUniformBufferResourceKey(label: string): string {
  return webGpuResourceKey("view-uniform-buffer", label);
}

export function shaderModuleResourceKey(label: string): string {
  return webGpuResourceKey("shader-module", label);
}

export function renderPipelineResourceKey(cacheKey: string): string {
  return webGpuResourceKey("render-pipeline", cacheKey);
}

export function bindGroupResourceKey(label: string): string {
  return webGpuResourceKey("bind-group", label);
}

export function commandBufferResourceKey(label: string): string {
  return webGpuResourceKey("command-buffer", label);
}

export function commandEncoderResourceKey(label: string): string {
  return webGpuResourceKey("command-encoder", label);
}
