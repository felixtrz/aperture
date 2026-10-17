import type {
  StandardMaterialAsset,
  StandardMaterialExtension,
} from "@aperture-engine/render";

export const EXTENSION_PARAMETER_LAYOUT = {
  entries: [
    {
      binding: 0,
      visibility: 3,
      buffer: { type: "uniform", minBindingSize: 48 },
    },
  ],
} as const;
const parameterBuffers = new WeakMap<object, Map<string, GPUBuffer>>();
/** A renderer-scoped device owns this stable per-material allocation. */
export function extensionParameterBuffer(
  device: GPUDevice,
  key: string,
  material: StandardMaterialAsset,
): GPUBuffer {
  let buffers = parameterBuffers.get(device);
  if (buffers === undefined) {
    buffers = new Map();
    parameterBuffers.set(device, buffers);
  }
  let buffer = buffers.get(key);
  if (buffer === undefined) {
    buffer = device.createBuffer({
      label: `extension/${key}`,
      size: 48,
      usage: 0x40 | 0x08,
    });
    buffers.set(key, buffer);
  }
  const extension = material.extension!;
  device.queue.writeBuffer(
    buffer,
    0,
    new Float32Array([
      ...extension.parameters,
      ...(extension.previousParameters ?? extension.parameters),
      material.renderState.alphaCutoff,
      material.baseColorFactor[3],
      material.renderState.alphaMode === "mask" ? 1 : 0,
      0,
    ]),
  );
  return buffer;
}
export function extensionVisibilityDeclarations(
  extension: StandardMaterialExtension,
  group: number,
): string {
  return `${extension.shader.code}
struct ApertureVisibilityParameters { current: vec4f, previous: vec4f, visibility: vec4f };
@group(${group}) @binding(0) var<uniform> apertureParameters: ApertureVisibilityParameters;
fn apertureVisibility(uv: vec2f) -> bool {
  let opacity = ${extension.opacity ? `${extension.opacity}(uv, apertureParameters.current)` : "1.0"};
  return apertureParameters.visibility.z == 0.0 || opacity * apertureParameters.visibility.y >= apertureParameters.visibility.x;
}
`;
}
export function extensionVertexExpression(
  extension: StandardMaterialExtension,
): string {
  return extension.deform
    ? `${extension.deform}(ApertureVertex(input.position,input.normal),input.uv,apertureParameters.current).position`
    : "input.position";
}
export function extensionShadowShader(
  extension: StandardMaterialExtension,
): string {
  return `${extensionVisibilityDeclarations(extension, 1)}
struct ShadowPassMatrix { viewProjection: mat4x4f };
@group(0) @binding(0) var<uniform> shadowPassMatrix: ShadowPassMatrix;
@group(0) @binding(1) var<storage,read> worldTransforms: array<mat4x4f>;
struct VertexInput { @location(0) position:vec3f, @location(1) normal:vec3f, @location(2) uv:vec2f, @builtin(instance_index) instanceIndex:u32 };
struct VertexOutput { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn vs_main(input:VertexInput)->VertexOutput {
 var output:VertexOutput;
 output.position = shadowPassMatrix.viewProjection * worldTransforms[input.instanceIndex] * vec4f(${extensionVertexExpression(extension)},1.0);
 output.uv = input.uv;
 return output;
}
@fragment fn fs_main(input:VertexOutput) { if (!apertureVisibility(input.uv)) { discard; } }
`;
}
export function extensionPickShader(
  code: string,
  extension: StandardMaterialExtension,
): string {
  return (
    extensionVisibilityDeclarations(extension, 3) +
    code
      .replace(
        "  @location(0) @interpolate(flat) pickId: u32,",
        "  @location(0) @interpolate(flat) pickId: u32,\n  @location(1) uv: vec2f,",
      )
      .replace(
        "world * vec4f(input.position, 1.0)",
        `world * vec4f(${extensionVertexExpression(extension)}, 1.0)`,
      )
      .replace(
        "  output.pickId =",
        "  output.uv = input.uv;\n  output.pickId =",
      )
      .replace(
        "  output.id = input.pickId;",
        "  if (!apertureVisibility(input.uv)) { discard; }\n  output.id = input.pickId;",
      )
  );
}
