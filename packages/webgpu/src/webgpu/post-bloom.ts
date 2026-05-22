import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "./render-pass-commands.js";

export interface CreateWebGpuBloomPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly threshold?: number;
  readonly intensity?: number;
  readonly radiusPixels?: number;
}

interface CachedBloomPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuBloomPostEffect(
  options: CreateWebGpuBloomPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "bloom";
  const label = options.label ?? "Bloom Post Effect";
  const enabled = options.enabled;
  const threshold = clampFinite(options.threshold ?? 0.8, 0, 0.999);
  const intensity = clampFinite(options.intensity ?? 0.75, 0, 8);
  const radiusPixels = clampFinite(options.radiusPixels ?? 1.5, 0.25, 16);
  let cachedPipeline: CachedBloomPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];
      const pipelineKey = [
        "webgpu-post-bloom",
        prepareOptions.outputFormat,
        threshold.toFixed(4),
        intensity.toFixed(4),
        radiusPixels.toFixed(4),
      ].join("|");
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createBloomPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              threshold,
              intensity,
              radiusPixels,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedBloomPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createBloomPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedBloomPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `Bloom post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedBloomPass(id, label, [], diagnostics);
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
          message: `Bloom post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedBloomPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `Bloom post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedBloomPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
        ],
      });

      return preparedBloomPass(
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
            resourceKey: `${id}:input:${prepareOptions.input.label}`,
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

function createBloomPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly label: string;
  readonly effectId: string;
  readonly threshold: number;
  readonly intensity: number;
  readonly radiusPixels: number;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedBloomPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const key = [
    "webgpu-post-bloom",
    options.outputFormat,
    options.threshold.toFixed(4),
    options.intensity.toFixed(4),
    options.radiusPixels.toFixed(4),
  ].join("|");
  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: bloomPostEffectWgsl({
      threshold: options.threshold,
      intensity: options.intensity,
      radiusPixels: options.radiusPixels,
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

  return { key, pipeline };
}

function createBloomPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedBloomPass(
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
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
}

function wgslNumber(value: number): string {
  return value.toFixed(6);
}

function bloomPostEffectWgsl(options: {
  readonly threshold: number;
  readonly intensity: number;
  readonly radiusPixels: number;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const BLOOM_THRESHOLD = ${wgslNumber(options.threshold)};
const BLOOM_INTENSITY = ${wgslNumber(options.intensity)};
const BLOOM_RADIUS_PIXELS = ${wgslNumber(options.radiusPixels)};
const LUMA = vec3f(0.299, 0.587, 0.114);

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

fn sampleColor(uv: vec2f) -> vec4f {
  return textureSample(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)));
}

fn brightContribution(color: vec3f) -> vec3f {
  let luminance = dot(color, LUMA);
  let amount = smoothstep(BLOOM_THRESHOLD, 1.0, luminance);
  return color * amount;
}

fn glowSample(uv: vec2f, texel: vec2f, offset: vec2f, weight: f32) -> vec3f {
  let color = sampleColor(uv + texel * offset * BLOOM_RADIUS_PIXELS).rgb;
  return brightContribution(color) * weight;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(inputTexture, 0));
  let texel = 1.0 / max(dimensions, vec2f(1.0));
  let uv = input.uv;
  let base = sampleColor(uv);

  var bloom = brightContribution(base.rgb) * 0.10;
  bloom += glowSample(uv, texel, vec2f(1.0, 0.0), 0.16);
  bloom += glowSample(uv, texel, vec2f(-1.0, 0.0), 0.16);
  bloom += glowSample(uv, texel, vec2f(0.0, 1.0), 0.16);
  bloom += glowSample(uv, texel, vec2f(0.0, -1.0), 0.16);
  bloom += glowSample(uv, texel, vec2f(1.0, 1.0), 0.08);
  bloom += glowSample(uv, texel, vec2f(-1.0, 1.0), 0.08);
  bloom += glowSample(uv, texel, vec2f(1.0, -1.0), 0.08);
  bloom += glowSample(uv, texel, vec2f(-1.0, -1.0), 0.08);
  bloom += glowSample(uv, texel, vec2f(2.0, 0.0), 0.05);
  bloom += glowSample(uv, texel, vec2f(-2.0, 0.0), 0.05);
  bloom += glowSample(uv, texel, vec2f(0.0, 2.0), 0.05);
  bloom += glowSample(uv, texel, vec2f(0.0, -2.0), 0.05);

  let color = min(base.rgb + bloom * BLOOM_INTENSITY, vec3f(1.0));
  return vec4f(color, base.a);
}
`;
}
