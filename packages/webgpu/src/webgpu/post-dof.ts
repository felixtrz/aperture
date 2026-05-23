import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "./render-pass-commands.js";

export interface CreateWebGpuDofPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly near?: number;
  readonly far?: number;
  readonly focusDistance?: number;
  readonly focusRange?: number;
  readonly aperture?: number;
  readonly maxBlurPixels?: number;
  readonly nearBlur?: boolean;
}

interface CachedDofPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuDofPostEffect(
  options: CreateWebGpuDofPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "dof";
  const label = options.label ?? "DOF Post Effect";
  const enabled = options.enabled;
  const near = clampFinite(options.near ?? 0.1, 0.0001, 100000);
  const far = clampFinite(
    options.far ?? 1000,
    Math.max(near + 0.0001, 0.0002),
    1000000,
  );
  const focusDistance = clampFinite(options.focusDistance ?? 4, near, far);
  const focusRange = clampFinite(options.focusRange ?? 1, 0.001, far - near);
  const aperture = clampFinite(options.aperture ?? 1, 0, 8);
  const maxBlurPixels = clampFinite(options.maxBlurPixels ?? 8, 0, 48);
  const nearBlur = options.nearBlur ?? true;
  let cachedPipeline: CachedDofPostPipeline | null = null;
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
          message: `DOF post effect '${id}' requires the renderer-owned scene depth texture.`,
        });
        return preparedDofPass(id, label, [], diagnostics);
      }

      if (prepareOptions.depth.sampleCount !== 1) {
        diagnostics.push({
          code: "webGpuPostPass.depthTextureUnsupportedSampleCount",
          effectId: id,
          message: `DOF post effect '${id}' requires a single-sample depth texture, but '${prepareOptions.depth.label}' has sample count ${prepareOptions.depth.sampleCount}.`,
        });
        return preparedDofPass(id, label, [], diagnostics);
      }

      const pipelineKey = dofPipelineKey({
        outputFormat: prepareOptions.outputFormat,
        near,
        far,
        focusDistance,
        focusRange,
        aperture,
        maxBlurPixels,
        nearBlur,
      });
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createDofPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              near,
              far,
              focusDistance,
              focusRange,
              aperture,
              maxBlurPixels,
              nearBlur,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedDofPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createDofPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedDofPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `DOF post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedDofPass(id, label, [], diagnostics);
      }

      const depthView = prepareOptions.depth.texture.createView?.();

      if (depthView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `DOF post effect '${id}' cannot sample depth texture '${prepareOptions.depth.label}'.`,
        });
        return preparedDofPass(id, label, [], diagnostics);
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
          message: `DOF post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedDofPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `DOF post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedDofPass(id, label, [], diagnostics);
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

      return preparedDofPass(
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
            resourceKey: `${id}:input:${prepareOptions.input.label}:depth:${prepareOptions.depth.label}:focus:${focusDistance.toFixed(2)}:aperture:${aperture.toFixed(2)}`,
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

function dofPipelineKey(options: {
  readonly outputFormat: string;
  readonly near: number;
  readonly far: number;
  readonly focusDistance: number;
  readonly focusRange: number;
  readonly aperture: number;
  readonly maxBlurPixels: number;
  readonly nearBlur: boolean;
}): string {
  return [
    "webgpu-post-dof",
    options.outputFormat,
    `near:${options.near.toFixed(4)}`,
    `far:${options.far.toFixed(3)}`,
    `focus:${options.focusDistance.toFixed(3)}`,
    `range:${options.focusRange.toFixed(3)}`,
    `aperture:${options.aperture.toFixed(3)}`,
    `max:${options.maxBlurPixels.toFixed(3)}`,
    `nearBlur:${String(options.nearBlur)}`,
  ].join("|");
}

function createDofPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly near: number;
  readonly far: number;
  readonly focusDistance: number;
  readonly focusRange: number;
  readonly aperture: number;
  readonly maxBlurPixels: number;
  readonly nearBlur: boolean;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedDofPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `DOF post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `DOF post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: dofPostEffectWgsl(options),
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
    key: dofPipelineKey(options),
    pipeline,
  };
}

function createDofPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `DOF post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedDofPass(
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

const dofSampleOffsets = [
  [0.0, 0.4],
  [0.15, 0.37],
  [0.29, 0.29],
  [-0.37, 0.15],
  [0.4, 0.0],
  [0.37, -0.15],
  [0.29, -0.29],
  [-0.15, -0.37],
  [0.0, -0.4],
  [-0.15, 0.37],
  [-0.29, 0.29],
  [0.37, 0.15],
  [-0.4, 0.0],
  [-0.37, -0.15],
  [-0.29, -0.29],
  [0.15, -0.37],
  [0.135, 0.333],
  [-0.333, 0.135],
  [0.333, -0.135],
  [-0.135, -0.333],
  [-0.135, 0.333],
  [0.333, 0.135],
  [-0.333, -0.135],
  [0.135, -0.333],
  [0.203, 0.203],
  [0.28, 0.0],
  [0.203, -0.203],
  [0.0, -0.28],
  [-0.203, 0.203],
  [-0.28, 0.0],
  [-0.203, -0.203],
  [0.0, 0.28],
  [0.116, 0.116],
  [0.16, 0.0],
  [0.116, -0.116],
  [0.0, -0.16],
  [-0.116, 0.116],
  [-0.16, 0.0],
  [-0.116, -0.116],
  [0.0, 0.16],
] as const;

function dofSampleAccumulationWgsl(): string {
  return dofSampleOffsets
    .map(
      ([x, y], index) => `
  let tap${index} = weightedSample(textureUv, vec2f(${wgslFloat(x)}, ${wgslFloat(y)}), blurPixels, texel, dims);
  sum = sum + tap${index}.rgb;
  weightSum = weightSum + tap${index}.a;`,
    )
    .join("\n");
}

function dofPostEffectWgsl(options: {
  readonly near: number;
  readonly far: number;
  readonly focusDistance: number;
  readonly focusRange: number;
  readonly aperture: number;
  readonly maxBlurPixels: number;
  readonly nearBlur: boolean;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var depthTexture: texture_depth_2d;

const NEAR_PLANE: f32 = ${wgslFloat(options.near)};
const FAR_PLANE: f32 = ${wgslFloat(options.far)};
const FOCUS_DISTANCE: f32 = ${wgslFloat(options.focusDistance)};
const FOCUS_RANGE: f32 = ${wgslFloat(options.focusRange)};
const APERTURE: f32 = ${wgslFloat(options.aperture)};
const MAX_BLUR_PIXELS: f32 = ${wgslFloat(options.maxBlurPixels)};
const NEAR_BLUR: bool = ${options.nearBlur ? "true" : "false"};

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

fn loadDepthUv(uv: vec2f, dims: vec2u) -> f32 {
  return textureLoad(depthTexture, coordFromUv(uv, dims), 0);
}

fn viewDepth(rawDepth: f32) -> f32 {
  let denominator = max(FAR_PLANE - rawDepth * (FAR_PLANE - NEAR_PLANE), 0.000001);
  return (NEAR_PLANE * FAR_PLANE) / denominator;
}

fn blurPixelsForDepth(rawDepth: f32) -> f32 {
  if (rawDepth >= 0.9999 || APERTURE <= 0.0 || MAX_BLUR_PIXELS <= 0.0) {
    return 0.0;
  }

  let depth = viewDepth(rawDepth);
  let halfRange = FOCUS_RANGE * 0.5;
  let farStart = FOCUS_DISTANCE + halfRange;
  let nearStart = max(NEAR_PLANE, FOCUS_DISTANCE - halfRange);
  var coc = 0.0;

  if (depth > farStart) {
    coc = (depth - farStart) / FOCUS_RANGE;
  } else if (NEAR_BLUR && depth < nearStart) {
    coc = (nearStart - depth) / FOCUS_RANGE;
  }

  return clamp(coc * APERTURE * MAX_BLUR_PIXELS, 0.0, MAX_BLUR_PIXELS);
}

fn sampleColor(uv: vec2f) -> vec4f {
  return textureSampleLevel(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0);
}

fn weightedSample(textureUv: vec2f, offset: vec2f, blurPixels: f32, texel: vec2f, dims: vec2u) -> vec4f {
  let sampleUv = textureUv + offset * blurPixels * texel;
  let sampleDepth = loadDepthUv(sampleUv, dims);
  let sampleBlur = blurPixelsForDepth(sampleDepth);
  let depthWeight = clamp(sampleBlur / max(blurPixels, 0.001), 0.0, 1.0);
  let weight = max(0.08, depthWeight);
  return vec4f(sampleColor(sampleUv).rgb * weight, weight);
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let textureUv = vec2f(input.uv.x, 1.0 - input.uv.y);
  let source = sampleColor(textureUv);
  let dims = textureDimensions(depthTexture);
  let centerDepth = loadDepthUv(textureUv, dims);
  let blurPixels = blurPixelsForDepth(centerDepth);

  if (blurPixels <= 0.25) {
    return source;
  }

  let texel = vec2f(1.0 / f32(dims.x), 1.0 / f32(dims.y));
  var sum = source.rgb;
  var weightSum = 1.0;
${dofSampleAccumulationWgsl()}

  return vec4f(sum / weightSum, source.a);
}
`;
}
