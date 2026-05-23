import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "./render-pass-commands.js";

export interface CreateWebGpuSsrPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly opacity?: number;
  readonly maxSteps?: number;
  readonly stridePixels?: number;
  readonly thickness?: number;
}

interface CachedSsrPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuSsrPostEffect(
  options: CreateWebGpuSsrPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "ssr";
  const label = options.label ?? "SSR Post Effect";
  const enabled = options.enabled;
  const opacity = clampFinite(options.opacity ?? 0.42, 0, 1);
  const maxSteps = clampInteger(options.maxSteps ?? 28, 4, 96);
  const stridePixels = clampFinite(options.stridePixels ?? 3.5, 1, 24);
  const thickness = clampFinite(options.thickness ?? 0.045, 0.001, 0.35);
  let cachedPipeline: CachedSsrPostPipeline | null = null;
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
          message: `SSR post effect '${id}' requires the renderer-owned scene depth texture.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      if (prepareOptions.depth.sampleCount !== 1) {
        diagnostics.push({
          code: "webGpuPostPass.depthTextureUnsupportedSampleCount",
          effectId: id,
          message: `SSR post effect '${id}' requires a single-sample depth texture, but '${prepareOptions.depth.label}' has sample count ${prepareOptions.depth.sampleCount}.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const pipelineKey = ssrPipelineKey({
        outputFormat: prepareOptions.outputFormat,
        opacity,
        maxSteps,
        stridePixels,
        thickness,
      });
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createSsrPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              opacity,
              maxSteps,
              stridePixels,
              thickness,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedSsrPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createSsrPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const depthView = prepareOptions.depth.texture.createView?.();

      if (depthView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' cannot sample depth texture '${prepareOptions.depth.label}'.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
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
          message: `SSR post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
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

      return preparedSsrPass(
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
            resourceKey: `${id}:input:${prepareOptions.input.label}:depth:${prepareOptions.depth.label}:opacity:${opacity.toFixed(2)}`,
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

function ssrPipelineKey(options: {
  readonly outputFormat: string;
  readonly opacity: number;
  readonly maxSteps: number;
  readonly stridePixels: number;
  readonly thickness: number;
}): string {
  return [
    "webgpu-post-ssr",
    options.outputFormat,
    `opacity:${options.opacity.toFixed(3)}`,
    `steps:${options.maxSteps}`,
    `stride:${options.stridePixels.toFixed(3)}`,
    `thickness:${options.thickness.toFixed(4)}`,
  ].join("|");
}

function createSsrPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly opacity: number;
  readonly maxSteps: number;
  readonly stridePixels: number;
  readonly thickness: number;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedSsrPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `SSR post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `SSR post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: ssrPostEffectWgsl(options),
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
    key: ssrPipelineKey(options),
    pipeline,
  };
}

function createSsrPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `SSR post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedSsrPass(
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

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function wgslFloat(value: number): string {
  return value.toFixed(6);
}

function ssrPostEffectWgsl(options: {
  readonly opacity: number;
  readonly maxSteps: number;
  readonly stridePixels: number;
  readonly thickness: number;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var depthTexture: texture_depth_2d;

const OPACITY: f32 = ${wgslFloat(options.opacity)};
const MAX_STEPS: u32 = ${options.maxSteps}u;
const STRIDE_PIXELS: f32 = ${wgslFloat(options.stridePixels)};
const THICKNESS: f32 = ${wgslFloat(options.thickness)};

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

fn sampleColor(uv: vec2f) -> vec4f {
  return textureSampleLevel(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0);
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let textureUv = vec2f(input.uv.x, 1.0 - input.uv.y);
  let source = sampleColor(textureUv);
  let dims = textureDimensions(depthTexture);
  let centerDepth = loadDepthUv(textureUv, dims);

  if (centerDepth >= 0.9999 || OPACITY <= 0.0) {
    return source;
  }

  let receiverMask = smoothstep(0.48, 0.78, textureUv.y);
  if (receiverMask <= 0.001) {
    return source;
  }

  let texel = vec2f(1.0 / f32(dims.x), 1.0 / f32(dims.y));
  var hitColor = vec3f(0.0);
  var hitWeight = 0.0;

  for (var step = 1u; step <= MAX_STEPS; step = step + 1u) {
    let distancePixels = f32(step) * STRIDE_PIXELS;
    let marchUv = textureUv + vec2f((0.5 - textureUv.x) * 0.015 * f32(step), -distancePixels * texel.y);

    if (marchUv.y <= 0.0 || marchUv.x <= 0.0 || marchUv.x >= 1.0) {
      break;
    }

    let sampleDepth = loadDepthUv(marchUv, dims);
    let depthDelta = centerDepth - sampleDepth;
    let hit = smoothstep(THICKNESS * 0.25, THICKNESS, depthDelta);

    if (hit > 0.0) {
      let edgeFade = smoothstep(0.02, 0.16, min(min(marchUv.x, 1.0 - marchUv.x), marchUv.y));
      let distanceFade = 1.0 - (f32(step) / f32(MAX_STEPS));
      hitColor = sampleColor(marchUv).rgb;
      hitWeight = hit * edgeFade * distanceFade;
      break;
    }
  }

  if (hitWeight <= 0.0) {
    let mirrorUv = vec2f(textureUv.x, clamp(1.0 - textureUv.y, 0.0, 1.0));
    hitColor = sampleColor(mirrorUv).rgb;
    hitWeight = 0.28 * (1.0 - smoothstep(0.98, 1.0, centerDepth));
  }

  let reflectionMask = receiverMask * hitWeight * OPACITY;
  let reflected = mix(source.rgb, hitColor, clamp(reflectionMask, 0.0, 1.0));
  return vec4f(reflected, source.a);
}
`;
}
