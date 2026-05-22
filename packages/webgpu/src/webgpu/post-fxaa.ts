import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "./render-pass-commands.js";

export interface CreateWebGpuFxaaPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
}

interface CachedFxaaPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuFxaaPostEffect(
  options: CreateWebGpuFxaaPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "fxaa";
  const label = options.label ?? "FXAA Post Effect";
  const enabled = options.enabled;
  let cachedPipeline: CachedFxaaPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];
      const pipelineKey = `webgpu-post-fxaa|${prepareOptions.outputFormat}`;
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createFxaaPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedFxaaPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createFxaaPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedFxaaPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `FXAA post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedFxaaPass(id, label, [], diagnostics);
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
          message: `FXAA post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedFxaaPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `FXAA post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedFxaaPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
        ],
      });

      return preparedFxaaPass(
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

function createFxaaPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedFxaaPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `FXAA post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `FXAA post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: fxaaPostEffectWgsl,
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
    key: `webgpu-post-fxaa|${options.outputFormat}`,
    pipeline,
  };
}

function createFxaaPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `FXAA post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedFxaaPass(
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

const fxaaPostEffectWgsl = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const FXAA_REDUCE_MIN = 1.0 / 128.0;
const FXAA_REDUCE_MUL = 1.0 / 8.0;
const FXAA_SPAN_MAX = 8.0;
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

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(inputTexture, 0));
  let texel = 1.0 / max(dimensions, vec2f(1.0));
  let uv = input.uv;
  let rgbaM = sampleColor(uv);
  let rgbM = rgbaM.rgb;
  let opacity = rgbaM.a;

  let rgbNW = sampleColor(uv + texel * vec2f(-1.0, -1.0)).rgb;
  let rgbNE = sampleColor(uv + texel * vec2f(1.0, -1.0)).rgb;
  let rgbSW = sampleColor(uv + texel * vec2f(-1.0, 1.0)).rgb;
  let rgbSE = sampleColor(uv + texel * vec2f(1.0, 1.0)).rgb;

  let lumaNW = dot(rgbNW, LUMA);
  let lumaNE = dot(rgbNE, LUMA);
  let lumaSW = dot(rgbSW, LUMA);
  let lumaSE = dot(rgbSE, LUMA);
  let lumaM = dot(rgbM, LUMA);
  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  var dir = vec2f(
    -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
    ((lumaNW + lumaSW) - (lumaNE + lumaSE)),
  );
  let dirReduce = max(
    (lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL),
    FXAA_REDUCE_MIN,
  );
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(
    dir * rcpDirMin,
    vec2f(-FXAA_SPAN_MAX),
    vec2f(FXAA_SPAN_MAX),
  ) * texel;

  let rgbA = 0.5 * (
    sampleColor(uv + dir * (1.0 / 3.0 - 0.5)).rgb +
    sampleColor(uv + dir * (2.0 / 3.0 - 0.5)).rgb
  );
  let rgbB = rgbA * 0.5 + 0.25 * (
    sampleColor(uv + dir * -0.5).rgb +
    sampleColor(uv + dir * 0.5).rgb
  );
  let lumaB = dot(rgbB, LUMA);

  if (lumaB < lumaMin || lumaB > lumaMax) {
    return vec4f(rgbA, opacity);
  }

  return vec4f(rgbB, opacity);
}
`;
