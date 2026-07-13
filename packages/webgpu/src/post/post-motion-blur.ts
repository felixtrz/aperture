// Motion blur post stage (E4). Samples the scene color along the per-pixel
// screen-space velocity encoded in the motion-vector texture (the same buffer
// TAA consumes) and averages N taps centered on the current pixel, producing a
// directional smear along motion. Neutral velocity (a static pixel, cleared to
// 0.5,0.5) yields the input unchanged, so a still frame is a pass-through.
//
// Modeled on createWebGpuTonemapPostEffect / createWebGpuTaaPostEffect: a
// full-screen triangle pass with an input texture + sampler and the motion
// vector texture at binding 2 (matching the motion-vector UV convention the TAA
// stage uses). All tunables are baked into the WGSL, so the pipeline cache key
// carries them.

import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export interface CreateWebGpuMotionBlurPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  /**
   * Velocity multiplier. 1 samples across the full per-frame displacement; >1
   * exaggerates the smear, 0 disables it (pass-through). Clamped to [0, 8].
   */
  readonly intensity?: number;
  /** Tap count along the velocity vector. Clamped to [2, 32]. */
  readonly samples?: number;
  /**
   * Per-pixel velocity clamp in UV space (0..1). Caps the smear length so a
   * large frame-to-frame jump does not sample the whole screen. Clamped to
   * (0, 0.5].
   */
  readonly maxVelocity?: number;
}

interface CachedMotionBlurPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuMotionBlurPostEffect(
  options: CreateWebGpuMotionBlurPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "motion-blur";
  const label = options.label ?? "Motion Blur Post Effect";
  const enabled = options.enabled;
  const intensity = clampFinite(options.intensity ?? 1, 0, 8);
  const samples = clampInteger(options.samples ?? 12, 2, 32);
  const maxVelocity = clampFinite(options.maxVelocity ?? 0.1, 0.0001, 0.5);
  let cachedPipeline: CachedMotionBlurPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    requiresMotionVectors: true,
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];

      if (prepareOptions.motionVector === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.motionVectorTextureUnavailable",
          effectId: id,
          message: `Motion blur post effect '${id}' requires a renderer-owned motion-vector texture.`,
        });
        return preparedMotionBlurPass(id, label, [], diagnostics);
      }

      const pipelineKey = motionBlurPipelineKey({
        outputFormat: prepareOptions.outputFormat,
        intensity,
        samples,
        maxVelocity,
      });
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createMotionBlurPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              key: pipelineKey,
              code: motionBlurPostEffectWgsl({
                intensity,
                samples,
                maxVelocity,
              }),
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedMotionBlurPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createMotionBlurPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedMotionBlurPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `Motion blur post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedMotionBlurPass(id, label, [], diagnostics);
      }

      const motionVectorView =
        prepareOptions.motionVector.texture.createView?.();

      if (motionVectorView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.motionVectorTextureUnavailable",
          effectId: id,
          message: `Motion blur post effect '${id}' cannot sample motion-vector texture '${prepareOptions.motionVector.label}'.`,
        });
        return preparedMotionBlurPass(id, label, [], diagnostics);
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
          message: `Motion blur post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedMotionBlurPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `Motion blur post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedMotionBlurPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
          { binding: 2, resource: motionVectorView },
        ],
      });

      return preparedMotionBlurPass(
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
            resourceKey: `${id}:input:${prepareOptions.input.label}:motion:${prepareOptions.motionVector.label}:intensity:${intensity.toFixed(2)}:samples:${samples}`,
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

function motionBlurPipelineKey(options: {
  readonly outputFormat: string;
  readonly intensity: number;
  readonly samples: number;
  readonly maxVelocity: number;
}): string {
  return [
    "webgpu-post-motion-blur",
    options.outputFormat,
    `intensity:${options.intensity.toFixed(3)}`,
    `samples:${options.samples}`,
    `maxVelocity:${options.maxVelocity.toFixed(4)}`,
  ].join("|");
}

function createMotionBlurPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly key: string;
  readonly code: string;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedMotionBlurPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `Motion blur post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `Motion blur post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: options.code,
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

  return { key: options.key, pipeline };
}

function createMotionBlurPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `Motion blur post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedMotionBlurPass(
  effectId: string,
  label: string,
  commands: readonly RenderPassCommand[],
  diagnostics: readonly WebGpuPostPassDiagnostic[],
): WebGpuPreparedPostEffectPass {
  return { effectId, label, commands, diagnostics };
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function wgslFloat(value: number): string {
  return value.toFixed(6);
}

export function motionBlurPostEffectWgsl(options: {
  readonly intensity: number;
  readonly samples: number;
  readonly maxVelocity: number;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var motionVectorTexture: texture_2d<f32>;

const SAMPLE_COUNT: u32 = ${options.samples}u;
const INTENSITY: f32 = ${wgslFloat(options.intensity)};
const MAX_VELOCITY: f32 = ${wgslFloat(options.maxVelocity)};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0),
  );
  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  // Match the TAA/motion-vector UV convention so velocity and color align.
  output.uv = position * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  // textureSampleLevel (explicit LOD) is used throughout so the sampling stays
  // valid under the non-uniform early-out below (textureSample would require
  // uniform control flow for its implicit derivatives).
  let center = textureSampleLevel(inputTexture, inputSampler, input.uv, 0.0);
  let encodedMotion = textureSampleLevel(motionVectorTexture, inputSampler, input.uv, 0.0).rg;
  // Decode the screen-space velocity (UV displacement per frame): a neutral
  // 0.5,0.5 sample decodes to zero, i.e. a static pixel is left unchanged.
  var velocity = (encodedMotion * 2.0 - vec2f(1.0)) * INTENSITY;
  let velocityLength = length(velocity);
  if (velocityLength > MAX_VELOCITY) {
    velocity = velocity * (MAX_VELOCITY / velocityLength);
  }

  if (velocityLength <= 0.00001 || INTENSITY <= 0.0) {
    return center;
  }

  var accumulated = center;
  var weight = 1.0;
  let denom = max(f32(SAMPLE_COUNT) - 1.0, 1.0);
  for (var i = 1u; i < SAMPLE_COUNT; i = i + 1u) {
    // Center the taps on the current pixel: t in [-0.5, 0.5].
    let t = (f32(i) / denom) - 0.5;
    let sampleUv = clamp(input.uv + velocity * t, vec2f(0.0), vec2f(1.0));
    accumulated = accumulated + textureSampleLevel(inputTexture, inputSampler, sampleUv, 0.0);
    weight = weight + 1.0;
  }

  let blurred = accumulated / weight;
  return vec4f(blurred.rgb, center.a);
}
`;
}
