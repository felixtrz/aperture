import type { CurrentTextureLike } from "../app/presentation/current-texture-view.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import { WEBGPU_TEXTURE_USAGE_FLAGS } from "../resources/textures/texture-resources.js";

export type WebGpuPostPassDiagnosticCode =
  | "webGpuPostPass.createTextureUnavailable"
  | "webGpuPostPass.textureCreationFailed"
  | "webGpuPostPass.createShaderModuleUnavailable"
  | "webGpuPostPass.createRenderPipelineUnavailable"
  | "webGpuPostPass.createSamplerUnavailable"
  | "webGpuPostPass.createBindGroupUnavailable"
  | "webGpuPostPass.inputTextureViewUnavailable"
  | "webGpuPostPass.pipelineLayoutUnavailable"
  | "webGpuPostPass.outputTextureUnavailable"
  | "webGpuPostPass.motionVectorTextureUnavailable"
  | "webGpuPostPass.depthTextureUnavailable"
  | "webGpuPostPass.depthTextureUnsupportedSampleCount";

export interface WebGpuPostPassDiagnostic {
  readonly code: WebGpuPostPassDiagnosticCode;
  readonly message: string;
  readonly effectId?: string;
}

export interface WebGpuPostPassDeviceLike {
  readonly createTexture?: (descriptor: unknown) => CurrentTextureLike;
  readonly createShaderModule?: (descriptor: unknown) => unknown;
  readonly createRenderPipeline?: (descriptor: unknown) => unknown;
  readonly createSampler?: (descriptor: unknown) => unknown;
  readonly createBindGroup?: (descriptor: unknown) => unknown;
}

export interface WebGpuPostPassTextureResource {
  readonly texture: CurrentTextureLike;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly label: string;
}

export interface WebGpuPostPassDepthTextureResource {
  readonly texture: CurrentTextureLike;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly sampleCount: number;
  readonly label: string;
}

export interface WebGpuPostPassTextureCacheSlot {
  current: WebGpuPostPassTextureResource | null;
}

export interface CreateWebGpuPostPassTextureResult {
  readonly valid: boolean;
  readonly resource: WebGpuPostPassTextureResource | null;
  readonly status: "created" | "reused" | "failed";
  readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
}

export interface WebGpuPostEffectPrepareOptions {
  readonly device: WebGpuPostPassDeviceLike;
  readonly input: WebGpuPostPassTextureResource;
  readonly motionVector?: WebGpuPostPassTextureResource;
  readonly depth?: WebGpuPostPassDepthTextureResource;
  readonly outputFormat: string;
  readonly width: number;
  readonly height: number;
  readonly frame: number;
  readonly passIndex: number;
  readonly isLast: boolean;
  readonly output?: WebGpuPostPassTextureResource;
  readonly label: string;
}

export type WebGpuPreparedPostEffectGraphPassKind =
  | "downsample"
  | "upsample"
  | "composite"
  | "custom";

export interface WebGpuPreparedPostEffectGraphPass {
  readonly label: string;
  readonly kind: WebGpuPreparedPostEffectGraphPassKind;
  readonly input: string;
  readonly output: "swapchain" | "offscreen";
  readonly outputResource?: WebGpuPostPassTextureResource;
  readonly width: number;
  readonly height: number;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
}

export interface WebGpuPreparedPostEffectGraphReport {
  readonly topology: "single-pass" | "downsample-upsample";
  readonly passCount: number;
  readonly resourceCount: number;
  readonly downsamplePasses: number;
  readonly upsamplePasses: number;
  readonly compositePasses: number;
  readonly levels: readonly {
    readonly width: number;
    readonly height: number;
  }[];
}

export interface WebGpuPreparedPostEffectGraph {
  readonly passes: readonly WebGpuPreparedPostEffectGraphPass[];
  readonly report: WebGpuPreparedPostEffectGraphReport;
}

export interface WebGpuPreparedPostEffectPass {
  readonly effectId: string;
  readonly label: string;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
  readonly graph?: WebGpuPreparedPostEffectGraph;
}

export interface WebGpuPostEffect {
  readonly id: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly requiresMotionVectors?: boolean;
  readonly requiresDepthTexture?: boolean;
  prepare(
    options: WebGpuPostEffectPrepareOptions,
  ): WebGpuPreparedPostEffectPass;
}

export interface CreateWebGpuCopyPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
}

interface CachedCopyPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuPostPassTextureCacheSlot(): WebGpuPostPassTextureCacheSlot {
  return { current: null };
}

export function createOrReuseWebGpuPostPassTexture(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly slot: WebGpuPostPassTextureCacheSlot;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly label: string;
}): CreateWebGpuPostPassTextureResult {
  const current = options.slot.current;

  if (
    current !== null &&
    current.width === options.width &&
    current.height === options.height &&
    current.format === options.format
  ) {
    return {
      valid: true,
      resource: current,
      status: "reused",
      diagnostics: [],
    };
  }

  if (options.device.createTexture === undefined) {
    return {
      valid: false,
      resource: null,
      status: "failed",
      diagnostics: [
        {
          code: "webGpuPostPass.createTextureUnavailable",
          message: "WebGPU post pass cannot create intermediate textures.",
        },
      ],
    };
  }

  try {
    const texture = options.device.createTexture({
      label: options.label,
      size: { width: options.width, height: options.height },
      format: options.format,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT |
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_SRC,
    });
    const resource = {
      texture,
      width: options.width,
      height: options.height,
      format: options.format,
      label: options.label,
    };

    options.slot.current = resource;
    return {
      valid: true,
      resource,
      status: "created",
      diagnostics: [],
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      status: "failed",
      diagnostics: [
        {
          code: "webGpuPostPass.textureCreationFailed",
          message: `WebGPU post pass texture creation failed: ${messageFromCause(
            cause,
          )}`,
        },
      ],
    };
  }
}

export function createWebGpuCopyPostEffect(
  options: CreateWebGpuCopyPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "copy";
  const label = options.label ?? "Copy Post Effect";
  const enabled = options.enabled;
  let cachedPipeline: CachedCopyPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];
      const pipelineKey = `webgpu-post-copy|${prepareOptions.outputFormat}`;
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createCopyPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedCopyPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createCopyPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedCopyPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `Post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedCopyPass(id, label, [], diagnostics);
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
          message: `Post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedCopyPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `Post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedCopyPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
        ],
      });

      return preparedCopyPass(
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

function createCopyPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedCopyPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `Post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `Post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: copyPostEffectWgsl,
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
    key: `webgpu-post-copy|${options.outputFormat}`,
    pipeline,
  };
}

function createCopyPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `Post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedCopyPass(
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

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const copyPostEffectWgsl = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

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
  return textureSample(inputTexture, inputSampler, input.uv);
}
`;
