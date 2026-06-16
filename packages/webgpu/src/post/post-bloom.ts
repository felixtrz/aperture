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

export interface CreateWebGpuBloomPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly threshold?: number;
  readonly intensity?: number;
  readonly radiusPixels?: number;
  readonly levels?: number;
}

type BloomPostPipelineKind =
  | "brightpass"
  | "downsample"
  | "upsample"
  | "composite";

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
  const levelCount = clampInteger(options.levels ?? 2, 2, 6);
  const pipelines = new Map<string, CachedBloomPostPipeline>();
  const brightpassSlot = createWebGpuPostPassTextureCacheSlot();
  const downsampleSlots = Array.from({ length: levelCount }, () =>
    createWebGpuPostPassTextureCacheSlot(),
  );
  const upsampleSlots = Array.from({ length: levelCount - 1 }, () =>
    createWebGpuPostPassTextureCacheSlot(),
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

      // Canonical bloom: threshold at FULL resolution first (a half-res
      // bilinear fetch averages small bright features with their dark
      // neighbours before the threshold sees them, cutting them to black),
      // then blur down the chain without re-thresholding.
      const brightpassTexture = createOrReuseWebGpuPostPassTexture({
        device: prepareOptions.device,
        slot: brightpassSlot,
        width: prepareOptions.input.width,
        height: prepareOptions.input.height,
        format: prepareOptions.outputFormat,
        label: `${prepareOptions.label}:${id}:brightpass`,
      });

      diagnostics.push(...brightpassTexture.diagnostics);

      if (!brightpassTexture.valid || brightpassTexture.resource === null) {
        return preparedBloomPass(id, label, [], diagnostics);
      }

      const downsampleResources = prepareBloomTextureChain({
        device: prepareOptions.device,
        slots: downsampleSlots,
        source: brightpassTexture.resource,
        format: prepareOptions.outputFormat,
        label: `${prepareOptions.label}:${id}:downsample`,
        diagnostics,
      });

      if (downsampleResources === null) {
        return preparedBloomPass(id, label, [], diagnostics);
      }

      const upsampleResources = prepareBloomUpsampleTextures({
        device: prepareOptions.device,
        slots: upsampleSlots,
        downsampleResources,
        format: prepareOptions.outputFormat,
        label: `${prepareOptions.label}:${id}:upsample`,
        diagnostics,
      });

      if (upsampleResources === null) {
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
        radiusPixels,
        brightpassResource: brightpassTexture.resource,
        downsampleResources,
        upsampleResources,
        ...(prepareOptions.output === undefined
          ? {}
          : { output: prepareOptions.output }),
      });

      return preparedBloomPass(id, label, [], diagnostics, graph);
    },
  };
}

function prepareBloomTextureChain(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly slots: readonly WebGpuPostPassTextureCacheSlot[];
  readonly source: WebGpuPostPassTextureResource;
  readonly format: string;
  readonly label: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): readonly WebGpuPostPassTextureResource[] | null {
  const resources: WebGpuPostPassTextureResource[] = [];
  let source = options.source;

  for (let index = 0; index < options.slots.length; index += 1) {
    const slot = options.slots[index];

    if (slot === undefined) {
      return null;
    }

    const width = Math.max(1, Math.floor(source.width / 2));
    const height = Math.max(1, Math.floor(source.height / 2));
    const texture = createOrReuseWebGpuPostPassTexture({
      device: options.device,
      slot,
      width,
      height,
      format: options.format,
      label: `${options.label}:${index}:${width}x${height}`,
    });

    options.diagnostics.push(...texture.diagnostics);

    if (!texture.valid || texture.resource === null) {
      return null;
    }

    resources.push(texture.resource);
    source = texture.resource;
  }

  return resources;
}

function prepareBloomUpsampleTextures(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly slots: readonly WebGpuPostPassTextureCacheSlot[];
  readonly downsampleResources: readonly WebGpuPostPassTextureResource[];
  readonly format: string;
  readonly label: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): readonly WebGpuPostPassTextureResource[] | null {
  const resources: WebGpuPostPassTextureResource[] = [];

  for (let index = 0; index < options.slots.length; index += 1) {
    const slot = options.slots[index];
    const downsample = options.downsampleResources[index];

    if (slot === undefined || downsample === undefined) {
      return null;
    }

    const texture = createOrReuseWebGpuPostPassTexture({
      device: options.device,
      slot,
      width: downsample.width,
      height: downsample.height,
      format: options.format,
      label: `${options.label}:${index}:${downsample.width}x${downsample.height}`,
    });

    options.diagnostics.push(...texture.diagnostics);

    if (!texture.valid || texture.resource === null) {
      return null;
    }

    resources.push(texture.resource);
  }

  return resources;
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
  readonly radiusPixels: number;
  readonly brightpassResource: WebGpuPostPassTextureResource;
  readonly downsampleResources: readonly WebGpuPostPassTextureResource[];
  readonly upsampleResources: readonly WebGpuPostPassTextureResource[];
}): WebGpuPreparedPostEffectGraph {
  const passes: WebGpuPreparedPostEffectGraphPass[] = [];

  // Full-resolution bright extraction before any downsampling.
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
      radiusPixels: options.radiusPixels,
    }),
  );

  let input = options.brightpassResource;

  for (let level = 0; level < options.downsampleResources.length; level += 1) {
    const output = options.downsampleResources[level];

    if (output === undefined) {
      continue;
    }

    passes.push(
      prepareSingleInputBloomGraphPass({
        device: options.device,
        pipelines: options.pipelines,
        sampler: options.sampler,
        effectId: options.effectId,
        label: `${options.frameLabel}:${options.effectId}:downsample:${level}`,
        kind: "downsample",
        input,
        output,
        outputFormat: options.outputFormat,
        threshold: options.threshold,
        intensity: options.intensity,
        radiusPixels: options.radiusPixels,
      }),
    );
    input = output;
  }

  let bloomInput =
    options.downsampleResources[options.downsampleResources.length - 1] ??
    options.input;

  for (
    let level = options.upsampleResources.length - 1;
    level >= 0;
    level -= 1
  ) {
    const output = options.upsampleResources[level];
    const skip = options.downsampleResources[level];

    if (output === undefined || skip === undefined) {
      continue;
    }

    // Progressive upsample with the canonical skip-add: blur the coarser
    // level up AND add the same-level downsample, so each level's extracted
    // energy survives to the composite instead of only the coarsest level's.
    passes.push(
      prepareUpsampleBloomGraphPass({
        device: options.device,
        pipelines: options.pipelines,
        sampler: options.sampler,
        effectId: options.effectId,
        label: `${options.frameLabel}:${options.effectId}:upsample:${level}`,
        coarse: bloomInput,
        skip,
        output,
        outputFormat: options.outputFormat,
        threshold: options.threshold,
        intensity: options.intensity,
        radiusPixels: options.radiusPixels,
      }),
    );
    bloomInput = output;
  }

  passes.push(
    prepareBloomCompositeGraphPass({
      device: options.device,
      pipelines: options.pipelines,
      sampler: options.sampler,
      effectId: options.effectId,
      label: `${options.frameLabel}:${options.effectId}:composite`,
      base: options.input,
      bloom: bloomInput,
      outputFormat: options.outputFormat,
      outputTarget: options.isLast ? "swapchain" : "offscreen",
      threshold: options.threshold,
      intensity: options.intensity,
      radiusPixels: options.radiusPixels,
      ...(options.output === undefined ? {} : { output: options.output }),
    }),
  );

  return {
    passes,
    report: {
      topology: "brightpass-downsample-upsample",
      passCount: passes.length,
      resourceCount:
        1 +
        options.downsampleResources.length +
        options.upsampleResources.length,
      brightpassPasses: 1,
      downsamplePasses: options.downsampleResources.length,
      upsamplePasses: options.upsampleResources.length,
      compositePasses: 1,
      levels: options.downsampleResources.map((resource) => ({
        width: resource.width,
        height: resource.height,
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
  readonly kind: Extract<BloomPostPipelineKind, "brightpass" | "downsample">;
  readonly input: WebGpuPostPassTextureResource;
  readonly output: WebGpuPostPassTextureResource;
  readonly outputFormat: string;
  readonly threshold: number;
  readonly intensity: number;
  readonly radiusPixels: number;
}): WebGpuPreparedPostEffectGraphPass {
  const diagnostics: WebGpuPostPassDiagnostic[] = [];
  const pipelineResult = getOrCreateBloomPostPipeline({
    device: options.device,
    pipelines: options.pipelines,
    outputFormat: options.outputFormat,
    label: `${options.label}:pipeline`,
    effectId: options.effectId,
    kind: options.kind,
    threshold: options.threshold,
    intensity: options.intensity,
    radiusPixels: options.radiusPixels,
    diagnostics,
  });

  const commands =
    pipelineResult === null
      ? []
      : createSingleInputBloomCommands({
          device: options.device,
          sampler: options.sampler,
          pipeline: pipelineResult.pipeline,
          pipelineKey: pipelineResult.key,
          effectId: options.effectId,
          label: options.label,
          input: options.input,
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

function prepareUpsampleBloomGraphPass(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly pipelines: Map<string, CachedBloomPostPipeline>;
  readonly sampler: unknown;
  readonly effectId: string;
  readonly label: string;
  readonly coarse: WebGpuPostPassTextureResource;
  readonly skip: WebGpuPostPassTextureResource;
  readonly output: WebGpuPostPassTextureResource;
  readonly outputFormat: string;
  readonly threshold: number;
  readonly intensity: number;
  readonly radiusPixels: number;
}): WebGpuPreparedPostEffectGraphPass {
  const diagnostics: WebGpuPostPassDiagnostic[] = [];
  const pipelineResult = getOrCreateBloomPostPipeline({
    device: options.device,
    pipelines: options.pipelines,
    outputFormat: options.outputFormat,
    label: `${options.label}:pipeline`,
    effectId: options.effectId,
    kind: "upsample",
    threshold: options.threshold,
    intensity: options.intensity,
    radiusPixels: options.radiusPixels,
    diagnostics,
  });

  const commands =
    pipelineResult === null
      ? []
      : createTwoInputBloomCommands({
          device: options.device,
          sampler: options.sampler,
          pipeline: pipelineResult.pipeline,
          pipelineKey: pipelineResult.key,
          effectId: options.effectId,
          label: options.label,
          first: options.coarse,
          second: options.skip,
          resourceKey: `${options.effectId}:upsample:${options.coarse.label}:${options.skip.label}`,
          diagnostics,
        });

  return {
    label: options.label,
    kind: "upsample",
    input: options.coarse.label,
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
  readonly bloom: WebGpuPostPassTextureResource;
  readonly output?: WebGpuPostPassTextureResource;
  readonly outputFormat: string;
  readonly outputTarget: "swapchain" | "offscreen";
  readonly threshold: number;
  readonly intensity: number;
  readonly radiusPixels: number;
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
    radiusPixels: options.radiusPixels,
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
          bloom: options.bloom,
          diagnostics,
        });

  return {
    label: options.label,
    kind: "composite",
    input: options.bloom.label,
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
  readonly radiusPixels: number;
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
    radiusPixels: options.radiusPixels,
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
    ],
  });

  return bloomDrawCommands({
    pipelineKey: options.pipelineKey,
    pipeline: options.pipeline,
    resourceKey: `${options.effectId}:input:${options.input.label}`,
    bindGroup,
  });
}

function createCompositeBloomCommands(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly sampler: unknown;
  readonly pipeline: unknown;
  readonly pipelineKey: string;
  readonly effectId: string;
  readonly label: string;
  readonly base: WebGpuPostPassTextureResource;
  readonly bloom: WebGpuPostPassTextureResource;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): readonly RenderPassCommand[] {
  return createTwoInputBloomCommands({
    device: options.device,
    sampler: options.sampler,
    pipeline: options.pipeline,
    pipelineKey: options.pipelineKey,
    effectId: options.effectId,
    label: options.label,
    first: options.base,
    second: options.bloom,
    resourceKey: `${options.effectId}:composite:${options.base.label}:${options.bloom.label}`,
    diagnostics: options.diagnostics,
  });
}

function createTwoInputBloomCommands(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly sampler: unknown;
  readonly pipeline: unknown;
  readonly pipelineKey: string;
  readonly effectId: string;
  readonly label: string;
  readonly first: WebGpuPostPassTextureResource;
  readonly second: WebGpuPostPassTextureResource;
  readonly resourceKey: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): readonly RenderPassCommand[] {
  const baseView = options.first.texture.createView?.();
  const bloomView = options.second.texture.createView?.();

  if (baseView === undefined || bloomView === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.inputTextureViewUnavailable",
      effectId: options.effectId,
      message: `Bloom post effect '${options.effectId}' cannot sample textures '${options.first.label}' and '${options.second.label}'.`,
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
      { binding: 2, resource: bloomView },
    ],
  });

  return bloomDrawCommands({
    pipelineKey: options.pipelineKey,
    pipeline: options.pipeline,
    resourceKey: options.resourceKey,
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
  readonly radiusPixels: number;
}): string {
  return [
    "webgpu-post-bloom",
    options.kind,
    options.outputFormat,
    options.threshold.toFixed(4),
    options.intensity.toFixed(4),
    options.radiusPixels.toFixed(4),
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

function wgslNumber(value: number): string {
  return value.toFixed(6);
}

function bloomPostEffectWgsl(options: {
  readonly kind: BloomPostPipelineKind;
  readonly threshold: number;
  readonly intensity: number;
  readonly radiusPixels: number;
}): string {
  const fragment =
    options.kind === "composite"
      ? bloomCompositeFragmentWgsl(options)
      : options.kind === "brightpass"
        ? bloomBrightpassFragmentWgsl({ threshold: options.threshold })
        : options.kind === "upsample"
          ? bloomUpsampleFragmentWgsl({ radiusPixels: options.radiusPixels })
          : bloomSingleInputFragmentWgsl({
              radiusPixels: options.radiusPixels,
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
  // Threshold at FULL resolution with a single tap: the uv lands exactly on
  // the matching input texel center, so the linear sampler returns the texel
  // value untouched and small bright features survive the extraction.
  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const BLOOM_THRESHOLD = ${wgslNumber(options.threshold)};
const LUMA = vec3f(0.299, 0.587, 0.114);

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(inputTexture, inputSampler, clamp(input.uv, vec2f(0.0), vec2f(1.0))).rgb;
  let luminance = dot(color, LUMA);
  let amount = smoothstep(BLOOM_THRESHOLD, 1.0, luminance);
  return vec4f(color * amount, 1.0);
}
`;
}

function bloomSingleInputFragmentWgsl(options: {
  readonly radiusPixels: number;
}): string {
  const radius = wgslNumber(options.radiusPixels);

  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const BLOOM_RADIUS_PIXELS = ${radius};

fn sampleColor(uv: vec2f) -> vec3f {
  return textureSample(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(inputTexture, 0));
  let texel = 1.0 / max(dimensions, vec2f(1.0));
  let uv = input.uv;
  var color = sampleColor(uv) * 0.36;
  color += sampleColor(uv + texel * vec2f(1.0, 0.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleColor(uv + texel * vec2f(-1.0, 0.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleColor(uv + texel * vec2f(0.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleColor(uv + texel * vec2f(0.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleColor(uv + texel * vec2f(1.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  color += sampleColor(uv + texel * vec2f(-1.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  color += sampleColor(uv + texel * vec2f(1.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  color += sampleColor(uv + texel * vec2f(-1.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  return vec4f(color, 1.0);
}
`;
}

function bloomUpsampleFragmentWgsl(options: {
  readonly radiusPixels: number;
}): string {
  // Progressive upsample: blur the coarser level up and ADD the same-level
  // downsample (skip connection), preserving each level's extracted energy.
  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var coarseTexture: texture_2d<f32>;
@group(0) @binding(2) var skipTexture: texture_2d<f32>;

const BLOOM_RADIUS_PIXELS = ${wgslNumber(options.radiusPixels)};

fn sampleCoarse(uv: vec2f) -> vec3f {
  return textureSample(coarseTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(coarseTexture, 0));
  let texel = 1.0 / max(dimensions, vec2f(1.0));
  let uv = input.uv;
  var color = sampleCoarse(uv) * 0.36;
  color += sampleCoarse(uv + texel * vec2f(1.0, 0.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleCoarse(uv + texel * vec2f(-1.0, 0.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleCoarse(uv + texel * vec2f(0.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleCoarse(uv + texel * vec2f(0.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.14;
  color += sampleCoarse(uv + texel * vec2f(1.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  color += sampleCoarse(uv + texel * vec2f(-1.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  color += sampleCoarse(uv + texel * vec2f(1.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  color += sampleCoarse(uv + texel * vec2f(-1.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.02;
  let skip = textureSample(skipTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
  return vec4f(color + skip, 1.0);
}
`;
}

function bloomCompositeFragmentWgsl(options: {
  readonly intensity: number;
  readonly radiusPixels: number;
}): string {
  return `
@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var baseTexture: texture_2d<f32>;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;

const BLOOM_INTENSITY = ${wgslNumber(options.intensity)};
const BLOOM_RADIUS_PIXELS = ${wgslNumber(options.radiusPixels)};

fn sampleBase(uv: vec2f) -> vec4f {
  return textureSample(baseTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)));
}

fn sampleBloom(uv: vec2f) -> vec3f {
  return textureSample(bloomTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(bloomTexture, 0));
  let texel = 1.0 / max(dimensions, vec2f(1.0));
  let uv = input.uv;
  let base = sampleBase(uv);
  var bloom = sampleBloom(uv) * 0.42;
  bloom += sampleBloom(uv + texel * vec2f(1.0, 0.0) * BLOOM_RADIUS_PIXELS) * 0.145;
  bloom += sampleBloom(uv + texel * vec2f(-1.0, 0.0) * BLOOM_RADIUS_PIXELS) * 0.145;
  bloom += sampleBloom(uv + texel * vec2f(0.0, 1.0) * BLOOM_RADIUS_PIXELS) * 0.145;
  bloom += sampleBloom(uv + texel * vec2f(0.0, -1.0) * BLOOM_RADIUS_PIXELS) * 0.145;
  let color = min(base.rgb + bloom * BLOOM_INTENSITY, vec3f(1.0));
  return vec4f(color, base.a);
}
`;
}
