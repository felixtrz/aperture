import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "./render-pass-commands.js";

export interface CreateWebGpuSsaoPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly radiusPixels?: number;
  readonly intensity?: number;
  readonly depthBias?: number;
  readonly maxDepthDifference?: number;
}

interface CachedSsaoPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuSsaoPostEffect(
  options: CreateWebGpuSsaoPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "ssao";
  const label = options.label ?? "SSAO Post Effect";
  const enabled = options.enabled;
  const radiusPixels = clampFinite(options.radiusPixels ?? 9, 1, 48);
  const intensity = clampFinite(options.intensity ?? 1.35, 0, 4);
  const depthBias = clampFinite(options.depthBias ?? 0.0008, 0, 0.05);
  const maxDepthDifference = clampFinite(
    options.maxDepthDifference ?? 0.075,
    0.001,
    0.5,
  );
  let cachedPipeline: CachedSsaoPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    requiresDepthTexture: true,
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];

      if (prepareOptions.depth === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.depthTextureUnavailable",
          effectId: id,
          message: `SSAO post effect '${id}' requires the renderer-owned scene depth texture.`,
        });
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      if (prepareOptions.depth.sampleCount !== 1) {
        diagnostics.push({
          code: "webGpuPostPass.depthTextureUnsupportedSampleCount",
          effectId: id,
          message: `SSAO post effect '${id}' requires a single-sample depth texture, but '${prepareOptions.depth.label}' has sample count ${prepareOptions.depth.sampleCount}.`,
        });
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      const pipelineKey = ssaoPipelineKey({
        outputFormat: prepareOptions.outputFormat,
        radiusPixels,
        intensity,
        depthBias,
        maxDepthDifference,
      });
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createSsaoPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              radiusPixels,
              intensity,
              depthBias,
              maxDepthDifference,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createSsaoPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `SSAO post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      const depthView = prepareOptions.depth.texture.createView?.();

      if (depthView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `SSAO post effect '${id}' cannot sample depth texture '${prepareOptions.depth.label}'.`,
        });
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      const layout = (
        pipelineResult.pipeline as {
          readonly getBindGroupLayout?: (group: number) => unknown;
        }
      ).getBindGroupLayout?.(0);

      if (layout === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.pipelineLayoutUnavailable",
          effectId: id,
          message: `SSAO post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `SSAO post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedSsaoPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
          { binding: 2, resource: depthView },
        ],
      });

      return preparedSsaoPass(
        id,
        label,
        [
          {
            kind: "setPipeline",
            renderId: 0,
            pipelineKey,
            pipeline: pipelineResult.pipeline,
          },
          {
            kind: "setBindGroup",
            renderId: 0,
            index: 0,
            resourceKey: `${id}:input:${prepareOptions.input.label}:depth:${prepareOptions.depth.label}:radius:${radiusPixels.toFixed(2)}:intensity:${intensity.toFixed(2)}`,
            bindGroup,
          },
          {
            kind: "draw",
            renderId: 0,
            vertexCount: 3,
            instanceCount: 1,
            firstVertex: 0,
            firstInstance: 0,
          },
        ],
        diagnostics,
      );
    },
  };
}

function ssaoPipelineKey(options: {
  readonly outputFormat: string;
  readonly radiusPixels: number;
  readonly intensity: number;
  readonly depthBias: number;
  readonly maxDepthDifference: number;
}): string {
  return [
    "webgpu-post-ssao",
    options.outputFormat,
    `radius:${options.radiusPixels.toFixed(3)}`,
    `intensity:${options.intensity.toFixed(3)}`,
    `bias:${options.depthBias.toFixed(5)}`,
    `range:${options.maxDepthDifference.toFixed(4)}`,
  ].join("|");
}

function createSsaoPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly radiusPixels: number;
  readonly intensity: number;
  readonly depthBias: number;
  readonly maxDepthDifference: number;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedSsaoPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `SSAO post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `SSAO post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: ssaoPostEffectWgsl({
      radiusPixels: options.radiusPixels,
      intensity: options.intensity,
      depthBias: options.depthBias,
      maxDepthDifference: options.maxDepthDifference,
    }),
  });
  const pipeline = options.device.createRenderPipeline({
    label: options.label,
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: options.outputFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  return {
    key: ssaoPipelineKey(options),
    pipeline,
  };
}

function createSsaoPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `SSAO post effect '${options.effectId}' cannot create an input sampler.`,
    });
    return null;
  }

  return options.device.createSampler({
    label: `aperture/post/${options.effectId}/sampler`,
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
}

function preparedSsaoPass(
  effectId: string,
  label: string,
  commands: readonly RenderPassCommand[],
  diagnostics: readonly WebGpuPostPassDiagnostic[],
): WebGpuPreparedPostEffectPass {
  return {
    effectId,
    label,
    commands,
    diagnostics,
  };
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function wgslFloat(value: number): string {
  return value.toFixed(6);
}

function ssaoPostEffectWgsl(options: {
  readonly radiusPixels: number;
  readonly intensity: number;
  readonly depthBias: number;
  readonly maxDepthDifference: number;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var depthTexture: texture_depth_2d;

const SAMPLE_COUNT: u32 = 12u;
const RADIUS_PIXELS: f32 = ${wgslFloat(options.radiusPixels)};
const INTENSITY: f32 = ${wgslFloat(options.intensity)};
const DEPTH_BIAS: f32 = ${wgslFloat(options.depthBias)};
const MAX_DEPTH_DIFFERENCE: f32 = ${wgslFloat(options.maxDepthDifference)};
const SAMPLE_OFFSETS = array<vec2f, 12>(
  vec2f(1.0000, 0.0000),
  vec2f(0.5000, 0.8660),
  vec2f(-0.5000, 0.8660),
  vec2f(-1.0000, 0.0000),
  vec2f(-0.5000, -0.8660),
  vec2f(0.5000, -0.8660),
  vec2f(0.7071, 0.7071),
  vec2f(-0.7071, 0.7071),
  vec2f(-0.7071, -0.7071),
  vec2f(0.7071, -0.7071),
  vec2f(0.0000, 0.5200),
  vec2f(0.0000, -0.5200),
);

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 2.0),
    vec2f(0.0, 0.0),
    vec2f(2.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

fn clampCoord(coord: vec2i, dims: vec2u) -> vec2i {
  let maxCoord = vec2i(i32(dims.x) - 1, i32(dims.y) - 1);
  return clamp(coord, vec2i(0, 0), maxCoord);
}

fn coordFromUv(uv: vec2f, dims: vec2u) -> vec2i {
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(0.999999));
  let pixel = clampedUv * vec2f(f32(dims.x), f32(dims.y));
  return clampCoord(vec2i(i32(pixel.x), i32(pixel.y)), dims);
}

fn loadDepth(coord: vec2i, dims: vec2u) -> f32 {
  return textureLoad(depthTexture, clampCoord(coord, dims), 0);
}

fn sampleColor(uv: vec2f) -> vec4f {
  return textureSample(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)));
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let textureUv = vec2f(input.uv.x, 1.0 - input.uv.y);
  let source = sampleColor(textureUv);
  let dims = textureDimensions(depthTexture);
  let centerCoord = coordFromUv(textureUv, dims);
  let centerDepth = loadDepth(centerCoord, dims);

  if (centerDepth >= 0.9999) {
    return source;
  }

  var occlusion = 0.0;
  var weightSum = 0.0;

  for (var i = 0u; i < SAMPLE_COUNT; i = i + 1u) {
    let unitOffset = SAMPLE_OFFSETS[i];
    let offset = unitOffset * RADIUS_PIXELS;
    let sampleCoord = centerCoord + vec2i(i32(offset.x), i32(offset.y));
    let sampleDepth = loadDepth(sampleCoord, dims);
    let depthDelta = centerDepth - sampleDepth;
    let contrast = abs(depthDelta);
    let depthContrast = smoothstep(DEPTH_BIAS, MAX_DEPTH_DIFFERENCE, contrast);
    let depthRange = 1.0 - smoothstep(
      MAX_DEPTH_DIFFERENCE * 4.0,
      MAX_DEPTH_DIFFERENCE * 12.0,
      contrast,
    );
    let occluderBias = select(0.45, 1.0, depthDelta > 0.0);
    let radialWeight = 1.0 - min(1.0, length(offset) / max(RADIUS_PIXELS, 1.0));
    let weight = max(0.08, radialWeight);
    occlusion = occlusion + depthContrast * depthRange * occluderBias * weight;
    weightSum = weightSum + weight;
  }

  let normalizedOcclusion = select(0.0, occlusion / weightSum, weightSum > 0.0);
  let visibility = 1.0 - min(0.85, normalizedOcclusion * INTENSITY);
  return vec4f(source.rgb * visibility, source.a);
}
`;
}
