import {
  createOrReuseWebGpuPostPassTexture,
  createWebGpuPostPassTextureCacheSlot,
  type WebGpuPostEffect,
  type WebGpuPostPassDiagnostic,
  type WebGpuPostPassDeviceLike,
  type WebGpuPostPassTextureCacheSlot,
  type WebGpuPostPassTextureResource,
  type WebGpuPreparedPostEffectGraph,
  type WebGpuPreparedPostEffectGraphPass,
  type WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";

export interface CreateWebGpuBloomPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly threshold?: number;
  readonly intensity?: number;
  readonly radius?: number;
  /**
   * Legacy Aperture blur radius fallback. Three.js BloomNode radius is
   * dimensionless; prefer `radius` for new code.
   */
  readonly radiusPixels?: number;
  readonly levels?: number;
}

type BloomPostPipelineKind =
  | "brightpass"
  | "blur-horizontal"
  | "blur-vertical"
  | "composite";

interface CachedBloomPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

interface BloomBlurParameterBuffer {
  readonly buffer: unknown;
  width: number;
  height: number;
}

interface BloomBlurParameterBufferSlot {
  current: BloomBlurParameterBuffer | null;
}

interface BloomPostBufferDeviceLike extends WebGpuPostPassDeviceLike {
  readonly createBuffer?: (descriptor: {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
    readonly mappedAtCreation?: boolean;
  }) => unknown;
  readonly queue?: {
    readonly writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
  };
}

const BLOOM_KERNEL_SIZES = [6, 10, 14, 18, 22, 26] as const;
const BLOOM_BLUR_PARAMETER_BUFFER_BYTES = 16;

export function createWebGpuBloomPostEffect(
  options: CreateWebGpuBloomPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "bloom";
  const label = options.label ?? "Bloom Post Effect";
  const enabled = options.enabled;
  const threshold = clampFinite(options.threshold ?? 0, 0, 64);
  const intensity = clampFinite(options.intensity ?? 0.75, 0, 8);
  const radius = clampFinite(
    options.radius ?? legacyRadiusPixelsToBloomRadius(options.radiusPixels),
    0,
    1,
  );
  const levelCount = clampInteger(
    options.levels ?? 5,
    1,
    BLOOM_KERNEL_SIZES.length,
  );
  const pipelines = new Map<string, CachedBloomPostPipeline>();
  const brightpassSlot = createWebGpuPostPassTextureCacheSlot();
  const horizontalSlots = Array.from({ length: levelCount }, () =>
    createWebGpuPostPassTextureCacheSlot(),
  );
  const verticalSlots = Array.from({ length: levelCount }, () =>
    createWebGpuPostPassTextureCacheSlot(),
  );
  const blurParameterSlots = Array.from(
    { length: levelCount },
    (): BloomBlurParameterBufferSlot => ({ current: null }),
  );
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];

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

      const brightpassTexture = createOrReuseWebGpuPostPassTexture({
        device: prepareOptions.device,
        slot: brightpassSlot,
        width: halfDimension(prepareOptions.input.width),
        height: halfDimension(prepareOptions.input.height),
        format: prepareOptions.outputFormat,
        label: `${prepareOptions.label}:${id}:brightpass`,
      });

      diagnostics.push(...brightpassTexture.diagnostics);

      if (!brightpassTexture.valid || brightpassTexture.resource === null) {
        return preparedBloomPass(id, label, [], diagnostics);
      }

      const mipResources = prepareBloomMipTextures({
        device: prepareOptions.device,
        horizontalSlots,
        verticalSlots,
        source: brightpassTexture.resource,
        format: prepareOptions.outputFormat,
        label: `${prepareOptions.label}:${id}`,
        diagnostics,
      });

      if (mipResources === null) {
        return preparedBloomPass(id, label, [], diagnostics);
      }

      const graph = prepareBloomGraph({
        device: prepareOptions.device,
        pipelines,
        sampler,
        effectId: id,
        label,
        frameLabel: prepareOptions.label,
        input: prepareOptions.input,
        outputFormat: prepareOptions.outputFormat,
        isLast: prepareOptions.isLast,
        threshold,
        intensity,
        radius,
        brightpassResource: brightpassTexture.resource,
        horizontalResources: mipResources.horizontal,
        verticalResources: mipResources.vertical,
        blurParameterSlots,
        ...(prepareOptions.output === undefined
          ? {}
          : { output: prepareOptions.output }),
      });

      return preparedBloomPass(id, label, [], diagnostics, graph);
    },
  };
}

function prepareBloomMipTextures(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly horizontalSlots: readonly WebGpuPostPassTextureCacheSlot[];
  readonly verticalSlots: readonly WebGpuPostPassTextureCacheSlot[];
  readonly source: WebGpuPostPassTextureResource;
  readonly format: string;
  readonly label: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): {
  readonly horizontal: readonly WebGpuPostPassTextureResource[];
  readonly vertical: readonly WebGpuPostPassTextureResource[];
} | null {
  const horizontal: WebGpuPostPassTextureResource[] = [];
  const vertical: WebGpuPostPassTextureResource[] = [];
  let width = options.source.width;
  let height = options.source.height;

  for (let index = 0; index < options.horizontalSlots.length; index += 1) {
    const horizontalSlot = options.horizontalSlots[index];
    const verticalSlot = options.verticalSlots[index];

    if (horizontalSlot === undefined || verticalSlot === undefined) {
      return null;
    }

    const horizontalTexture = createOrReuseWebGpuPostPassTexture({
      device: options.device,
      slot: horizontalSlot,
      width,
      height,
      format: options.format,
      label: `${options.label}:horizontal:${index}:${width}x${height}`,
    });

    options.diagnostics.push(...horizontalTexture.diagnostics);

    if (!horizontalTexture.valid || horizontalTexture.resource === null) {
      return null;
    }

    const verticalTexture = createOrReuseWebGpuPostPassTexture({
      device: options.device,
      slot: verticalSlot,
      width,
      height,
      format: options.format,
      label: `${options.label}:vertical:${index}:${width}x${height}`,
    });

    options.diagnostics.push(...verticalTexture.diagnostics);

    if (!verticalTexture.valid || verticalTexture.resource === null) {
      return null;
    }

    horizontal.push(horizontalTexture.resource);
    vertical.push(verticalTexture.resource);
    width = halfDimension(width);
    height = halfDimension(height);
  }

  return { horizontal, vertical };
}

function prepareBloomGraph(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly pipelines: Map<string, CachedBloomPostPipeline>;
  readonly sampler: unknown;
  readonly effectId: string;
  readonly label: string;
  readonly frameLabel: string;
  readonly input: WebGpuPostPassTextureResource;
  readonly output?: WebGpuPostPassTextureResource;
  readonly outputFormat: string;
  readonly isLast: boolean;
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
  readonly brightpassResource: WebGpuPostPassTextureResource;
  readonly horizontalResources: readonly WebGpuPostPassTextureResource[];
  readonly verticalResources: readonly WebGpuPostPassTextureResource[];
  readonly blurParameterSlots: readonly BloomBlurParameterBufferSlot[];
}): WebGpuPreparedPostEffectGraph {
  const passes: WebGpuPreparedPostEffectGraphPass[] = [];

  passes.push(
    prepareSingleInputBloomGraphPass({
      device: options.device,
      pipelines: options.pipelines,
      sampler: options.sampler,
      effectId: options.effectId,
      label: `${options.frameLabel}:${options.effectId}:brightpass`,
      kind: "brightpass",
      input: options.input,
      output: options.brightpassResource,
      outputFormat: options.outputFormat,
      threshold: options.threshold,
      intensity: options.intensity,
      radius: options.radius,
      kernelSize: null,
    }),
  );

  let input = options.brightpassResource;

  for (let level = 0; level < options.horizontalResources.length; level += 1) {
    const horizontalOutput = options.horizontalResources[level];
    const verticalOutput = options.verticalResources[level];
    const blurParameterSlot = options.blurParameterSlots[level];
    const kernelSize = bloomKernelSize(level);

    if (
      horizontalOutput === undefined ||
      verticalOutput === undefined ||
      blurParameterSlot === undefined
    ) {
      continue;
    }

    passes.push(
      prepareSingleInputBloomGraphPass({
        device: options.device,
        pipelines: options.pipelines,
        sampler: options.sampler,
        effectId: options.effectId,
        label: `${options.frameLabel}:${options.effectId}:blur-horizontal:${level}`,
        kind: "blur-horizontal",
        input,
        output: horizontalOutput,
        outputFormat: options.outputFormat,
        threshold: options.threshold,
        intensity: options.intensity,
        radius: options.radius,
        kernelSize,
        blurParameterSlot,
      }),
    );
    passes.push(
      prepareSingleInputBloomGraphPass({
        device: options.device,
        pipelines: options.pipelines,
        sampler: options.sampler,
        effectId: options.effectId,
        label: `${options.frameLabel}:${options.effectId}:blur-vertical:${level}`,
        kind: "blur-vertical",
        input: horizontalOutput,
        output: verticalOutput,
        outputFormat: options.outputFormat,
        threshold: options.threshold,
        intensity: options.intensity,
        radius: options.radius,
        kernelSize,
        blurParameterSlot,
      }),
    );
    input = verticalOutput;
  }

  passes.push(
    prepareBloomCompositeGraphPass({
      device: options.device,
      pipelines: options.pipelines,
      sampler: options.sampler,
      effectId: options.effectId,
      label: `${options.frameLabel}:${options.effectId}:composite`,
      base: options.input,
      bloomLevels: options.verticalResources,
      outputFormat: options.outputFormat,
      outputTarget: options.isLast ? "swapchain" : "offscreen",
      threshold: options.threshold,
      intensity: options.intensity,
      radius: options.radius,
      ...(options.output === undefined ? {} : { output: options.output }),
    }),
  );

  return {
    passes,
    report: {
      topology: "unreal-bloom",
      passCount: passes.length,
      resourceCount:
        1 +
        options.horizontalResources.length +
        options.verticalResources.length,
      brightpassPasses: 1,
      downsamplePasses: 0,
      upsamplePasses: 0,
      horizontalBlurPasses: options.horizontalResources.length,
      verticalBlurPasses: options.verticalResources.length,
      compositePasses: 1,
      levels: options.verticalResources.map((resource, index) => ({
        width: resource.width,
        height: resource.height,
        kernelSize: bloomKernelSize(index),
      })),
    },
  };
}

function prepareSingleInputBloomGraphPass(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly pipelines: Map<string, CachedBloomPostPipeline>;
  readonly sampler: unknown;
  readonly effectId: string;
  readonly label: string;
  readonly kind: Extract<
    BloomPostPipelineKind,
    "brightpass" | "blur-horizontal" | "blur-vertical"
  >;
  readonly input: WebGpuPostPassTextureResource;
  readonly output: WebGpuPostPassTextureResource;
  readonly outputFormat: string;
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
  readonly kernelSize: number | null;
  readonly blurParameterSlot?: BloomBlurParameterBufferSlot;
}): WebGpuPreparedPostEffectGraphPass {
  const diagnostics: WebGpuPostPassDiagnostic[] = [];
  const blurParameters =
    options.kind === "brightpass"
      ? null
      : prepareBloomBlurParameterBuffer({
          device: options.device,
          effectId: options.effectId,
          label: options.label,
          output: options.output,
          ...(options.blurParameterSlot === undefined
            ? {}
            : { slot: options.blurParameterSlot }),
          diagnostics,
        });
  const pipelineResult = getOrCreateBloomPostPipeline({
    device: options.device,
    pipelines: options.pipelines,
    outputFormat: options.outputFormat,
    label: `${options.label}:pipeline`,
    effectId: options.effectId,
    kind: options.kind,
    threshold: options.threshold,
    intensity: options.intensity,
    radius: options.radius,
    kernelSize: options.kernelSize,
    levelCount: 0,
    diagnostics,
  });

  const commands =
    pipelineResult === null ||
    (options.kind !== "brightpass" && blurParameters === null)
      ? []
      : createSingleInputBloomCommands({
          device: options.device,
          sampler: options.sampler,
          pipeline: pipelineResult.pipeline,
          pipelineKey: pipelineResult.key,
          effectId: options.effectId,
          label: options.label,
          input: options.input,
          ...(blurParameters === null ? {} : { blurParameters }),
          diagnostics,
        });

  return {
    label: options.label,
    kind: options.kind,
    input: options.input.label,
    output: "offscreen",
    outputResource: options.output,
    width: options.output.width,
    height: options.output.height,
    commands,
    diagnostics,
  };
}

function prepareBloomCompositeGraphPass(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly pipelines: Map<string, CachedBloomPostPipeline>;
  readonly sampler: unknown;
  readonly effectId: string;
  readonly label: string;
  readonly base: WebGpuPostPassTextureResource;
  readonly bloomLevels: readonly WebGpuPostPassTextureResource[];
  readonly output?: WebGpuPostPassTextureResource;
  readonly outputFormat: string;
  readonly outputTarget: "swapchain" | "offscreen";
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
}): WebGpuPreparedPostEffectGraphPass {
  const diagnostics: WebGpuPostPassDiagnostic[] = [];
  const pipelineResult = getOrCreateBloomPostPipeline({
    device: options.device,
    pipelines: options.pipelines,
    outputFormat: options.outputFormat,
    label: `${options.label}:pipeline`,
    effectId: options.effectId,
    kind: "composite",
    threshold: options.threshold,
    intensity: options.intensity,
    radius: options.radius,
    kernelSize: null,
    levelCount: options.bloomLevels.length,
    diagnostics,
  });

  if (options.outputTarget === "offscreen" && options.output === undefined) {
    diagnostics.push({
      code: "webGpuPostPass.outputTextureUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' requires an off-screen output texture before the next post effect.`,
    });
  }

  const commands =
    pipelineResult === null
      ? []
      : createCompositeBloomCommands({
          device: options.device,
          sampler: options.sampler,
          pipeline: pipelineResult.pipeline,
          pipelineKey: pipelineResult.key,
          effectId: options.effectId,
          label: options.label,
          base: options.base,
          bloomLevels: options.bloomLevels,
          diagnostics,
        });

  return {
    label: options.label,
    kind: "composite",
    input: options.bloomLevels.map((level) => level.label).join(","),
    output: options.outputTarget,
    ...(options.output === undefined ? {} : { outputResource: options.output }),
    width: options.output?.width ?? options.base.width,
    height: options.output?.height ?? options.base.height,
    commands,
    diagnostics,
  };
}

function getOrCreateBloomPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly pipelines: Map<string, CachedBloomPostPipeline>;
  readonly outputFormat: string;
  readonly label: string;
  readonly effectId: string;
  readonly kind: BloomPostPipelineKind;
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
  readonly kernelSize: number | null;
  readonly levelCount: number;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedBloomPostPipeline | null {
  const key = bloomPipelineKey(options);
  const cached = options.pipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const pipeline = createBloomPostPipeline({
    device: options.device,
    outputFormat: options.outputFormat,
    label: options.label,
    effectId: options.effectId,
    kind: options.kind,
    threshold: options.threshold,
    intensity: options.intensity,
    radius: options.radius,
    kernelSize: options.kernelSize,
    levelCount: options.levelCount,
    diagnostics: options.diagnostics,
  });

  if (pipeline !== null) {
    options.pipelines.set(key, pipeline);
  }

  return pipeline;
}

function createSingleInputBloomCommands(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly sampler: unknown;
  readonly pipeline: unknown;
  readonly pipelineKey: string;
  readonly effectId: string;
  readonly label: string;
  readonly input: WebGpuPostPassTextureResource;
  readonly blurParameters?: BloomBlurParameterBuffer;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): readonly RenderPassCommand[] {
  const inputView = options.input.texture.createView?.();

  if (inputView === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.inputTextureViewUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot sample input texture '${options.input.label}'.`,
    });
    return [];
  }

  const layout = (
    options.pipeline as {
      readonly getBindGroupLayout?: (group: number) => unknown;
    }
  ).getBindGroupLayout?.(0);

  if (layout === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.pipelineLayoutUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' pipeline does not expose group 0 bind-group layout.`,
    });
    return [];
  }

  if (options.device.createBindGroup === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createBindGroupUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot create a texture sampling bind group.`,
    });
    return [];
  }

  const bindGroup = options.device.createBindGroup({
    label: `${options.label}:bind-group`,
    layout,
    entries: [
      { binding: 0, resource: options.sampler },
      { binding: 1, resource: inputView },
      ...(options.blurParameters === undefined
        ? []
        : [
            {
              binding: 2,
              resource: { buffer: options.blurParameters.buffer },
            },
          ]),
    ],
  });

  return bloomDrawCommands({
    pipelineKey: options.pipelineKey,
    pipeline: options.pipeline,
    resourceKey:
      options.blurParameters === undefined
        ? `${options.effectId}:input:${options.input.label}`
        : `${options.effectId}:input:${options.input.label}:blur:${options.blurParameters.width}x${options.blurParameters.height}`,
    bindGroup,
  });
}

function prepareBloomBlurParameterBuffer(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly label: string;
  readonly output: WebGpuPostPassTextureResource;
  readonly slot?: BloomBlurParameterBufferSlot;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): BloomBlurParameterBuffer | null {
  if (options.slot === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createBufferUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot allocate blur parameters without a mip slot.`,
    });
    return null;
  }

  const device = options.device as BloomPostBufferDeviceLike;

  if (device.createBuffer === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createBufferUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot create blur parameter buffers.`,
    });
    return null;
  }

  if (device.queue?.writeBuffer === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.writeBufferUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot upload blur parameter buffers.`,
    });
    return null;
  }

  const width = Math.max(1, options.output.width);
  const height = Math.max(1, options.output.height);
  const current = options.slot.current;

  if (current !== null) {
    if (current.width !== width || current.height !== height) {
      const upload = new Float32Array([1 / width, 1 / height, 0, 0]);

      try {
        device.queue.writeBuffer(current.buffer, 0, upload);
      } catch (error) {
        options.diagnostics.push({
          code: "webGpuPostPass.writeBufferUnavailable",
          effectId: options.effectId,
          message:
            error instanceof Error
              ? error.message
              : `Bloom post effect '${options.effectId}' could not update blur parameters.`,
        });
        return null;
      }

      current.width = width;
      current.height = height;
    }

    return current;
  }

  let buffer: unknown;
  const upload = new Float32Array([1 / width, 1 / height, 0, 0]);

  try {
    buffer = device.createBuffer({
      label: `${options.label}:blur-params:${width}x${height}`,
      size: BLOOM_BLUR_PARAMETER_BUFFER_BYTES,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      mappedAtCreation: false,
    });
    device.queue.writeBuffer(buffer, 0, upload);
  } catch (error) {
    options.diagnostics.push({
      code: "webGpuPostPass.createBufferUnavailable",
      effectId: options.effectId,
      message:
        error instanceof Error
          ? error.message
          : `Bloom post effect '${options.effectId}' could not create blur parameters.`,
    });
    return null;
  }

  const next = { buffer, width, height };
  options.slot.current = next;
  return next;
}

function createCompositeBloomCommands(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly sampler: unknown;
  readonly pipeline: unknown;
  readonly pipelineKey: string;
  readonly effectId: string;
  readonly label: string;
  readonly base: WebGpuPostPassTextureResource;
  readonly bloomLevels: readonly WebGpuPostPassTextureResource[];
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): readonly RenderPassCommand[] {
  const baseView = options.base.texture.createView?.();
  const bloomViews = options.bloomLevels.map((level) =>
    level.texture.createView?.(),
  );

  if (baseView === undefined || bloomViews.some((view) => view === undefined)) {
    options.diagnostics.push({
      code: "webGpuPostPass.inputTextureViewUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot sample its composite input textures.`,
    });
    return [];
  }

  const layout = (
    options.pipeline as {
      readonly getBindGroupLayout?: (group: number) => unknown;
    }
  ).getBindGroupLayout?.(0);

  if (layout === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.pipelineLayoutUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' pipeline does not expose group 0 bind-group layout.`,
    });
    return [];
  }

  if (options.device.createBindGroup === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createBindGroupUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot create a texture sampling bind group.`,
    });
    return [];
  }

  const bindGroup = options.device.createBindGroup({
    label: `${options.label}:bind-group`,
    layout,
    entries: [
      { binding: 0, resource: options.sampler },
      { binding: 1, resource: baseView },
      ...bloomViews.map((view, index) => ({
        binding: index + 2,
        resource: view,
      })),
    ],
  });

  return bloomDrawCommands({
    pipelineKey: options.pipelineKey,
    pipeline: options.pipeline,
    resourceKey: `${options.effectId}:composite:${options.base.label}:${options.bloomLevels
      .map((level) => level.label)
      .join(":")}`,
    bindGroup,
  });
}

function bloomDrawCommands(options: {
  readonly pipelineKey: string;
  readonly pipeline: unknown;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}): readonly RenderPassCommand[] {
  return [
    {
      kind: "setPipeline",
      renderId: 0,
      pipelineKey: options.pipelineKey,
      pipeline: options.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: 0,
      index: 0,
      resourceKey: options.resourceKey,
      bindGroup: options.bindGroup,
    },
    {
      kind: "draw",
      renderId: 0,
      vertexCount: 3,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
    },
  ];
}

function createBloomPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly label: string;
  readonly effectId: string;
  readonly kind: BloomPostPipelineKind;
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
  readonly kernelSize: number | null;
  readonly levelCount: number;
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

  const key = bloomPipelineKey(options);
  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: bloomPostEffectWgsl(options),
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

function bloomPipelineKey(options: {
  readonly outputFormat: string;
  readonly kind: BloomPostPipelineKind;
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
  readonly kernelSize: number | null;
  readonly levelCount: number;
}): string {
  return [
    "webgpu-post-bloom",
    options.kind,
    options.outputFormat,
    options.threshold.toFixed(4),
    options.intensity.toFixed(4),
    options.radius.toFixed(4),
    options.kernelSize === null ? "no-kernel" : `kernel:${options.kernelSize}`,
    `levels:${options.levelCount}`,
  ].join("|");
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
  graph?: WebGpuPreparedPostEffectGraph,
): WebGpuPreparedPostEffectPass {
  return {
    effectId,
    label,
    commands,
    diagnostics,
    ...(graph === undefined ? {} : { graph }),
  };
}

function clampFinite(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.trunc(clampFinite(value, min, max));
}

function legacyRadiusPixelsToBloomRadius(value: number | undefined): number {
  if (value === undefined) return 0;
  return clampFinite(value / 16, 0, 1);
}

function halfDimension(value: number): number {
  return Math.max(1, Math.round(value / 2));
}

function bloomKernelSize(index: number): number {
  return BLOOM_KERNEL_SIZES[index] ?? 26;
}

function gaussianCoefficients(kernelSize: number): readonly number[] {
  const sigma = kernelSize / 3;
  return Array.from({ length: kernelSize }, (_, index) => {
    return (
      (0.39894 * Math.exp((-0.5 * index * index) / (sigma * sigma))) / sigma
    );
  });
}

function wgslNumber(value: number): string {
  return value.toFixed(6);
}

function bloomPostEffectWgsl(options: {
  readonly kind: BloomPostPipelineKind;
  readonly threshold: number;
  readonly intensity: number;
  readonly radius: number;
  readonly kernelSize: number | null;
  readonly levelCount: number;
}): string {
  const fragment =
    options.kind === "composite"
      ? bloomCompositeFragmentWgsl(options)
      : options.kind === "brightpass"
        ? bloomBrightpassFragmentWgsl({ threshold: options.threshold })
        : bloomGaussianBlurFragmentWgsl({
            direction:
              options.kind === "blur-horizontal" ? [1, 0] : ([0, 1] as const),
            kernelSize: options.kernelSize ?? BLOOM_KERNEL_SIZES[0],
          });

  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  // V is flipped (1 - clipY)/2 so screen-top (clip y=+1) samples texture v=0:
  // WebGPU framebuffer row 0 is the TOP. This MUST match the tonemap blit
  // (post-tonemap.ts) — every bloom pass samples the scene/intermediate targets
  // with the same orientation, otherwise enabling bloom flips the whole image
  // vertically (the GL-convention uvs (0,2),(0,0),(2,0) did exactly that).
  var uvs = array<vec2f, 3>(
    vec2f(0.0, -1.0),
    vec2f(0.0, 1.0),
    vec2f(2.0, 1.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

${fragment}
`;
}

function bloomBrightpassFragmentWgsl(options: {
  readonly threshold: number;
}): string {
  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const BLOOM_THRESHOLD = ${wgslNumber(options.threshold)};
const BLOOM_SMOOTH_WIDTH = 0.01;
const LUMA = vec3f(0.2126, 0.7152, 0.0722);

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(inputTexture, inputSampler, clamp(input.uv, vec2f(0.0), vec2f(1.0))).rgb;
  let luminance = dot(color, LUMA);
  let amount = smoothstep(BLOOM_THRESHOLD, BLOOM_THRESHOLD + BLOOM_SMOOTH_WIDTH, luminance);
  return vec4f(color * amount, 1.0);
}
`;
}

function bloomGaussianBlurFragmentWgsl(options: {
  readonly direction: readonly [number, number];
  readonly kernelSize: number;
}): string {
  const kernelSize = clampInteger(options.kernelSize, 1, 64);
  const coefficients = gaussianCoefficients(kernelSize)
    .map((coefficient) => wgslNumber(coefficient))
    .join(", ");

  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

struct BloomBlurParameters {
  invSize: vec2f,
  _padding: vec2f,
}

@group(0) @binding(2) var<uniform> blurParams: BloomBlurParameters;

const KERNEL_SIZE: i32 = ${kernelSize};
const BLUR_DIRECTION = vec2f(${wgslNumber(options.direction[0])}, ${wgslNumber(options.direction[1])});
const GAUSSIAN_COEFFICIENTS = array<f32, ${kernelSize}>(${coefficients});

fn sampleColor(uv: vec2f) -> vec3f {
  return textureSample(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let texel = blurParams.invSize;
  let uv = input.uv;
  var color = sampleColor(uv) * GAUSSIAN_COEFFICIENTS[0];
  for (var i: i32 = 1; i < KERNEL_SIZE; i = i + 1) {
    let offset = BLUR_DIRECTION * texel * f32(i);
    let weight = GAUSSIAN_COEFFICIENTS[i];
    color += (sampleColor(uv + offset) + sampleColor(uv - offset)) * weight;
  }
  return vec4f(color, 1.0);
}
`;
}

function bloomCompositeFragmentWgsl(options: {
  readonly intensity: number;
  readonly radius: number;
  readonly kernelSize: number | null;
  readonly levelCount: number;
}): string {
  const levelCount = clampInteger(
    options.levelCount,
    1,
    BLOOM_KERNEL_SIZES.length,
  );
  const textureBindings = Array.from(
    { length: levelCount },
    (_, index) =>
      `@group(0) @binding(${index + 2}) var bloomTexture${index}: texture_2d<f32>;`,
  ).join("\n");
  const bloomSum = Array.from({ length: levelCount }, (_, index) => {
    const factor = [1, 0.8, 0.6, 0.4, 0.2][index] ?? 0.2;
    return `  bloom += sampleBloom${index}(uv) * lerpBloomFactor(${wgslNumber(factor)});`;
  }).join("\n");

  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var baseTexture: texture_2d<f32>;
${textureBindings}

const BLOOM_INTENSITY = ${wgslNumber(options.intensity)};
const BLOOM_RADIUS = ${wgslNumber(options.radius)};

fn sampleBase(uv: vec2f) -> vec4f {
  return textureSample(baseTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)));
}

fn lerpBloomFactor(factor: f32) -> f32 {
  let mirrorFactor = 1.2 - factor;
  return mix(factor, mirrorFactor, BLOOM_RADIUS);
}

${Array.from(
  { length: levelCount },
  (_, index) => `
fn sampleBloom${index}(uv: vec2f) -> vec3f {
  return textureSample(bloomTexture${index}, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
}`,
).join("\n")}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.uv;
  let base = sampleBase(uv);
  var bloom = vec3f(0.0);
${bloomSum}
  let color = base.rgb + bloom * BLOOM_INTENSITY;
  return vec4f(color, base.a);
}
`;
}
