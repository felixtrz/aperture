// Final HDR -> swapchain tonemap post stage (M5-T4). Samples the persistent
// rgba16float linear-HDR scene buffer, applies `color * exposure`, the tonemap
// operator, and the sRGB OETF encode, writing the 8-bit swapchain. This replaces
// the in-material tonemap (which is skipped when the HDR scene buffer is active)
// so all intermediate post effects see linear HDR and tonemap runs exactly once.
//
// Modeled on createWebGpuFxaaPostEffect (post-fxaa.ts): a full-screen triangle
// pass with a single input texture + sampler. The operator and exposure are baked
// into the WGSL (exposure is supplied at app creation, like the tonemap operator),
// so the pipeline cache key includes both.

import {
  createOutputTonemapWgsl,
  type TonemapOperator,
} from "../output/output-stage-tonemap.js";
import {
  createOutputColorSpaceWgsl,
  type OutputColorSpace,
} from "../output/output-stage-color-space.js";
import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export interface CreateWebGpuTonemapPostEffectOptions {
  readonly operator: TonemapOperator;
  readonly exposure: number;
  readonly outputColorSpace?: OutputColorSpace;
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
}

interface CachedTonemapPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuTonemapPostEffect(
  options: CreateWebGpuTonemapPostEffectOptions,
): WebGpuPostEffect {
  const id = options.id ?? "hdr-tonemap";
  const label = options.label ?? "HDR Tonemap Post Effect";
  const enabled = options.enabled;
  const operator = options.operator;
  const exposure = Number.isFinite(options.exposure) ? options.exposure : 1;
  const outputColorSpace = options.outputColorSpace ?? "srgb";
  const variant = `${operator}|${outputColorSpace}|${exposure}`;
  const wgsl = tonemapPostEffectWgsl(operator, outputColorSpace, exposure);
  let cachedPipeline: CachedTonemapPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];
      const pipelineKey = `webgpu-post-tonemap|${variant}|${prepareOptions.outputFormat}`;
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createTonemapPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              code: wgsl,
              key: pipelineKey,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedTonemapPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createTonemapPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedTonemapPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `Tonemap post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedTonemapPass(id, label, [], diagnostics);
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
          message: `Tonemap post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedTonemapPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `Tonemap post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedTonemapPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
        ],
      });

      return preparedTonemapPass(
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

function createTonemapPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly code: string;
  readonly key: string;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedTonemapPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `Tonemap post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `Tonemap post effect '${options.effectId}' cannot create a render pipeline.`,
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

function createTonemapPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `Tonemap post effect '${options.effectId}' cannot create an input sampler.`,
    });
    return null;
  }

  return options.device.createSampler({
    label: `aperture/post/${options.effectId}/sampler`,
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
}

function preparedTonemapPass(
  effectId: string,
  label: string,
  commands: readonly RenderPassCommand[],
  diagnostics: readonly WebGpuPostPassDiagnostic[],
): WebGpuPreparedPostEffectPass {
  return { effectId, label, commands, diagnostics };
}

export function tonemapPostEffectWgsl(
  operator: TonemapOperator,
  outputColorSpace: OutputColorSpace,
  exposure: number,
): string {
  const exposureLiteral = formatExposureLiteral(exposure);

  return `
${createOutputTonemapWgsl(operator, { exposure: true })}

${createOutputColorSpaceWgsl(outputColorSpace)}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const APERTURE_EXPOSURE: f32 = ${exposureLiteral};

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

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let hdr = textureSample(inputTexture, inputSampler, clamp(input.uv, vec2f(0.0), vec2f(1.0)));
  let tonemapped = apertureOutputTonemap(hdr.rgb, APERTURE_EXPOSURE);
  let encoded = apertureOutputColorSpace(tonemapped);
  return vec4f(encoded, hdr.a);
}
`;
}

function formatExposureLiteral(exposure: number): string {
  const value = Number.isFinite(exposure) ? exposure : 1;
  const text = value.toString();
  return text.includes(".") || text.includes("e") || text.includes("E")
    ? text
    : `${text}.0`;
}
