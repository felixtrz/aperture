import {
  assetHandleKey,
  type AssetRegistry,
  type MaybePromise,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type PackedSnapshotViewUniforms,
  type ParticleGradientKeyframe,
  type ParticleEffectAsset,
  type ParticleEmitterEffectAsset,
  type ParticleScalarRange,
  type ParticleEmitterPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuBuffer, destroyWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import {
  createOrReuseWebGpuDepthTexture,
  WEBGPU_APP_DEPTH_FORMAT,
} from "../resources/textures/depth-texture-resource.js";
import {
  createSamplerGpuResource,
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type SamplerGpuResource,
  type TextureGpuResource,
} from "../resources/textures/texture-resources.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import {
  createParticleComputePipelineResource,
  createParticleRenderPipelineResource,
  particleBurstRenderPipelineCacheKey,
  particleComputePipelineCacheKey,
  particleRenderPipelineCacheKey,
  type CreateParticleComputePipelineResourceResult,
  type CreateParticleRenderPipelineResourceResult,
} from "../render/particles/particle-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
  type AppTextureSamplerResourceReuseReport,
} from "./app-texture-sampler-resources.js";
import type {
  ParticleBurstBatchSlot,
  ParticleBurstBatchGpuStateResource,
  ParticleEmitterCpuStateResource,
  ParticleEmitterGpuStateResource,
  ParticleSoftParamsResource,
  ParticleViewUniformBufferResource,
  WebGpuAppResourceCache,
} from "./resource-cache.js";
import {
  webGpuAppScenePassColorFormat,
  webGpuAppUsesHdrScenePass,
} from "./render-color-format.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";

interface WebGpuAppParticleContext {
  readonly canvas?: WebGpuCanvasLike;
  readonly initialization: {
    readonly device: unknown;
    readonly format: string;
  };
  readonly msaa: {
    readonly sampleCount: number;
  };
  // AI-17: output-stage config (the full app supplies these). Optional so minimal
  // particle contexts still build a byte-identical (no-op) pipeline.
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly sceneRenderFormat?: string;
}

export interface ParticleFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly overlayCommands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
  readonly report: ParticleFrameReport;
}

export interface ParticleFrameReport {
  readonly emitters: number;
  readonly liveParticles: number;
  readonly texturedEmitters: number;
  readonly statesCreated: number;
  readonly statesReused: number;
  readonly staleStatesRemoved: number;
  readonly dispatches: number;
  readonly textureResourcesCreated: number;
  readonly textureResourcesReused: number;
  readonly samplerResourcesCreated: number;
  readonly samplerResourcesReused: number;
}

const PARTICLE_VIEWPORT_FLOAT_OFFSET = 20;
const PARTICLE_DATA_FLOAT_STRIDE = 16;
const PARTICLE_BURST_DATA_FLOAT_STRIDE = 12;
const PARTICLE_CURVE_SAMPLE_COUNT = 16;
const PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT =
  4 + 4 + 4 + 4 * 4 + 4 * 4 + 16 * 4;
const PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET = 8;
const PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET = 12;
const PARTICLE_BURST_FRAME_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_FRAME_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_DEFAULT_TEXTURE_CACHE_KEY = "particle:default-white-texture";
const PARTICLE_DEFAULT_SAMPLER_CACHE_KEY = "particle:default-linear-sampler";

interface ParticleTextureSampler {
  readonly texture: TextureGpuResource;
  readonly sampler: SamplerGpuResource;
  readonly textureKey: string;
  readonly samplerKey: string;
}

interface ParticleSoftResources {
  readonly resourceKey: string;
  readonly depthView: unknown;
  readonly paramsBuffer: unknown;
}

interface PreparedParticleEmitterRecord {
  readonly emitter: ParticleEmitterPacket;
  readonly effectKey: string;
  readonly effect: ParticleEmitterEffectAsset;
  readonly renderPipeline: {
    readonly getBindGroupLayout: (group: number) => unknown;
  };
  readonly renderPipelineResource: NonNullable<
    CreateParticleRenderPipelineResourceResult["resource"]
  >;
  readonly textureSampler: ParticleTextureSampler;
  readonly softResources: ParticleSoftResources | null;
}

interface PreparedParticleEmitterFrameResources {
  readonly effectKey: string;
  readonly effect: ParticleEmitterEffectAsset;
  readonly renderPipeline: {
    readonly getBindGroupLayout: (group: number) => unknown;
  };
  readonly renderPipelineResource: NonNullable<
    CreateParticleRenderPipelineResourceResult["resource"]
  >;
  readonly textureSampler: ParticleTextureSampler;
  readonly softResources: ParticleSoftResources | null;
}

interface ParticleBurstBatchUnit {
  readonly kind: "burstBatch";
  readonly key: string;
  readonly records: PreparedParticleEmitterRecord[];
}

type ParticleFrameUnit =
  | ParticleBurstBatchUnit
  | {
      readonly kind: "single";
      readonly record: PreparedParticleEmitterRecord;
    };

export async function prepareParticleFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppParticleContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly reuse?: AppTextureSamplerResourceReuseReport;
  readonly time?: number;
}): Promise<ParticleFrameResources> {
  const emitters = options.snapshot.particleEmitters ?? [];

  if (emitters.length === 0) {
    const activeKeys = new Set<string>();
    const staleStatesRemoved =
      cleanupParticleStates(options.cache, activeKeys) +
      cleanupParticleBurstCpuStates(options.cache, activeKeys) +
      cleanupParticleBurstBatchStates(options.cache, activeKeys);
    const report = emptyParticleFrameReport();

    return {
      valid: true,
      commands: [],
      overlayCommands: [],
      diagnostics: [],
      report: {
        ...report,
        staleStatesRemoved,
      },
    };
  }

  return createParticleFrameResources({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: options.viewUniforms,
    ...(options.reuse === undefined ? {} : { reuse: options.reuse }),
    time: options.time ?? 0,
  });
}

export function getOrCreateWebGpuAppParticleComputePipeline(
  app: WebGpuAppParticleContext,
  cache: WebGpuAppResourceCache,
): MaybePromise<CreateParticleComputePipelineResourceResult> {
  const key = particleComputePipelineCacheKey();
  const cached = cache.particleComputePipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  return createParticleComputePipelineResource({
    device: app.initialization.device as Parameters<
      typeof createParticleComputePipelineResource
    >[0]["device"],
  }).then((result) => {
    cache.particleComputePipelines.set(key, result);
    return result;
  });
}

export function getOrCreateWebGpuAppParticleRenderPipeline(
  app: WebGpuAppParticleContext,
  cache: WebGpuAppResourceCache,
  blendMode: ParticleEmitterEffectAsset["runtime"]["blendMode"],
  renderMode: ParticleEmitterEffectAsset["runtime"]["renderMode"],
  softParticles = false,
): MaybePromise<CreateParticleRenderPipelineResourceResult> {
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = particleRenderPipelineCacheKey(
    colorFormat,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
    blendMode,
    tonemap,
    outputColorSpace,
    particlePipelineRenderMode(renderMode),
    softParticles,
  );
  const cached = cache.particleRenderPipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  return createParticleRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createParticleRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: app.msaa.sampleCount,
    blendMode,
    tonemap,
    outputColorSpace,
    renderMode: particlePipelineRenderMode(renderMode),
    softParticles,
  }).then((result) => {
    cache.particleRenderPipelines.set(key, result);
    return result;
  });
}

export function getOrCreateWebGpuAppParticleBurstRenderPipeline(
  app: WebGpuAppParticleContext,
  cache: WebGpuAppResourceCache,
  blendMode: ParticleEmitterEffectAsset["runtime"]["blendMode"],
  renderMode: ParticleEmitterEffectAsset["runtime"]["renderMode"],
  softParticles = false,
): MaybePromise<CreateParticleRenderPipelineResourceResult> {
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = particleBurstRenderPipelineCacheKey(
    colorFormat,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
    blendMode,
    tonemap,
    outputColorSpace,
    particlePipelineRenderMode(renderMode),
    softParticles,
  );
  const cached = cache.particleRenderPipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  return createParticleRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createParticleRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: app.msaa.sampleCount,
    blendMode,
    tonemap,
    outputColorSpace,
    variant: "burst",
    renderMode: particlePipelineRenderMode(renderMode),
    softParticles,
  }).then((result) => {
    cache.particleRenderPipelines.set(key, result);
    return result;
  });
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { readonly then?: unknown }).then === "function"
  );
}

function particlePipelineRenderMode(
  renderMode: ParticleEmitterEffectAsset["runtime"]["renderMode"],
): ParticleEmitterEffectAsset["runtime"]["renderMode"] {
  switch (renderMode) {
    case "stretched-billboard":
    case "horizontal-billboard":
    case "vertical-billboard":
    case "mesh":
    case "trail":
      return renderMode;
    default:
      return "billboard";
  }
}

type ParticleViewUniformBufferResult =
  | {
      readonly ok: true;
      readonly resource: ParticleViewUniformBufferResource;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

function getOrCreateParticleViewUniformBuffer(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: Parameters<typeof createWebGpuBuffer>[0]["device"];
  readonly data: Float32Array;
}): ParticleViewUniformBufferResult {
  const cached = options.cache.particleViewUniformBuffer;

  if (cached !== null && cached.byteLength >= options.data.byteLength) {
    if (options.device.queue?.writeBuffer === undefined) {
      return {
        ok: false,
        message:
          "Particle view uniform buffer updates require queue.writeBuffer.",
      };
    }

    options.device.queue.writeBuffer(
      cached.buffer,
      0,
      options.data.buffer,
      options.data.byteOffset,
      options.data.byteLength,
    );
    return { ok: true, resource: cached };
  }

  if (cached !== null) {
    destroyWebGpuBuffer(cached.buffer);
  }

  const created = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: "Particle/ViewUniforms",
      size: options.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: options.data,
    },
  });

  if (!created.ok) {
    return { ok: false, message: created.message };
  }

  const resource: ParticleViewUniformBufferResource = {
    buffer: created.buffer,
    byteLength: options.data.byteLength,
  };

  options.cache.particleViewUniformBuffer = resource;
  return { ok: true, resource };
}

async function createParticleFrameResources(options: {
  readonly app: WebGpuAppParticleContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly reuse?: AppTextureSamplerResourceReuseReport;
  readonly time: number;
}): Promise<ParticleFrameResources> {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const overlayCommands: RenderPassCommand[] = [];
  const report = emptyParticleFrameReport(
    options.snapshot.particleEmitters?.length ?? 0,
  );
  const mutableReport = report as MutableParticleFrameReport;
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
    readonly queue?: {
      readonly writeBuffer?: (
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => void;
    };
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];

  if (device.createBindGroup === undefined) {
    return {
      valid: false,
      commands,
      overlayCommands,
      diagnostics: [
        {
          code: "particleFrame.missingBindGroupSupport",
          message: "Particle frame resources require bind group creation.",
        },
      ],
      report,
    };
  }

  const reuse = options.reuse ?? createParticleTextureSamplerReuseReport();
  const reuseStart = particleTextureSamplerReuseSnapshot(reuse);
  const viewData = viewUniformData(options);
  const viewBuffer = getOrCreateParticleViewUniformBuffer({
    cache: options.cache,
    device,
    data: viewData,
  });

  if (!viewBuffer.ok) {
    return {
      valid: false,
      commands,
      overlayCommands,
      diagnostics: [
        {
          code: "particleFrame.viewBufferFailed",
          message: viewBuffer.message,
        },
      ],
      report,
    };
  }

  const activeStateKeys = new Set<string>();
  const activeBurstCpuStateKeys = new Set<string>();
  const activeBurstBatchKeys = new Set<string>();
  const textureSamplerFrameCache = new Map<string, ParticleTextureSampler>();
  const renderPipelineFrameCache = new Map<
    string,
    CreateParticleRenderPipelineResourceResult
  >();
  const emitterResourceFrameCache = new Map<
    string,
    PreparedParticleEmitterFrameResources | null
  >();
  const units: ParticleFrameUnit[] = [];
  let activeBurstGroup: ParticleBurstBatchUnit | null = null;

  for (const emitter of options.snapshot.particleEmitters ?? []) {
    const burstBatchable = isBatchableParticleBurst(emitter);
    const prepared = await prepareParticleEmitterFrameResources({
      app: options.app,
      assets: options.assets,
      cache: options.cache,
      device,
      snapshot: options.snapshot,
      emitter,
      burstBatchable,
      reuse,
      diagnostics,
      renderPipelineFrameCache,
      textureSamplerFrameCache,
      emitterResourceFrameCache,
    });

    if (prepared === null) {
      continue;
    }

    if (
      prepared.effect.runtime.texture !== undefined &&
      prepared.effect.runtime.texture !== null
    ) {
      mutableReport.texturedEmitters += 1;
    }

    const record: PreparedParticleEmitterRecord = {
      emitter,
      effectKey: prepared.effectKey,
      effect: prepared.effect,
      renderPipeline: prepared.renderPipeline,
      renderPipelineResource: prepared.renderPipelineResource,
      textureSampler: prepared.textureSampler,
      softResources: prepared.softResources,
    };

    if (burstBatchable) {
      const key = particleBurstBatchUnitKey(record);

      if (activeBurstGroup !== null && activeBurstGroup.key === key) {
        activeBurstGroup.records.push(record);
      } else {
        activeBurstGroup = {
          kind: "burstBatch",
          key,
          records: [record],
        };
        units.push(activeBurstGroup);
      }
      continue;
    }

    activeBurstGroup = null;
    units.push({ kind: "single", record });
  }

  for (const unit of units) {
    if (unit.kind === "burstBatch") {
      const batchReport = writeParticleBurstBatchCommands({
        cache: options.cache,
        device,
        viewBuffer: viewBuffer.resource.buffer,
        frame: options.snapshot.frame,
        time: options.time,
        unit,
        activeBurstCpuStateKeys,
        activeBurstBatchKeys,
        commands: firstSoftParticleRecord(unit)?.softResources
          ? overlayCommands
          : commands,
      });

      diagnostics.push(...batchReport.diagnostics);
      mutableReport.liveParticles += batchReport.liveParticles;
      mutableReport.statesCreated += batchReport.statesCreated;
      mutableReport.statesReused += batchReport.statesReused;
      continue;
    }

    const record = unit.record;

    const stateResult = getOrCreateParticleEmitterGpuState({
      cache: options.cache,
      device,
      emitter: record.emitter,
    });

    if (!stateResult.valid || stateResult.state === null) {
      diagnostics.push(...stateResult.diagnostics);
      continue;
    }

    activeStateKeys.add(stateResult.state.key);
    mutableReport.statesCreated += stateResult.created ? 1 : 0;
    mutableReport.statesReused += stateResult.created ? 0 : 1;

    let drawInstanceCount: number;

    if (record.emitter.mode === "burst" && record.emitter.burst !== undefined) {
      const burstReport = updateParticleBurstCpuState({
        device,
        state: stateResult.state,
        emitter: record.emitter,
        effect: record.effect,
        time: options.time,
      });

      diagnostics.push(...burstReport.diagnostics);
      drawInstanceCount = burstReport.liveParticles;
    } else {
      const continuousReport = updateParticleContinuousCpuState({
        device,
        state: stateResult.state,
        emitter: record.emitter,
        effect: record.effect,
        snapshot: options.snapshot,
        time: options.time,
      });

      diagnostics.push(...continuousReport.diagnostics);
      drawInstanceCount = continuousReport.liveParticles;
    }

    if (drawInstanceCount <= 0) {
      continue;
    }

    const viewBindGroup = device.createBindGroup({
      label: `Particle/ViewBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: viewBuffer.resource.buffer } },
      ],
    });
    mutableReport.liveParticles += drawInstanceCount;

    const particleBindGroup = device.createBindGroup({
      label: `Particle/RenderBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: stateResult.state.particleBuffer } },
      ],
    });
    const textureBindGroup = device.createBindGroup({
      label: `Particle/TextureBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: record.textureSampler.texture.view },
        { binding: 1, resource: record.textureSampler.sampler.sampler },
      ],
    });
    const softResources = record.softResources;
    const softBindGroup =
      softResources === null
        ? null
        : createParticleSoftBindGroup({
            device,
            renderPipeline: record.renderPipeline,
            emitterId: record.emitter.emitterId,
            groupIndex: 3,
            softResources,
          });
    const targetCommands = softResources === null ? commands : overlayCommands;

    targetCommands.push(
      {
        kind: "setPipeline",
        renderId: record.emitter.emitterId,
        pipelineKey: record.renderPipelineResource.cacheKey,
        pipeline: record.renderPipelineResource.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: record.emitter.emitterId,
        index: 0,
        resourceKey: `particle:view:${options.snapshot.frame}`,
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: record.emitter.emitterId,
        index: 1,
        resourceKey: stateResult.state.key,
        bindGroup: particleBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: record.emitter.emitterId,
        index: 2,
        resourceKey: `${record.textureSampler.textureKey}:${record.textureSampler.samplerKey}`,
        bindGroup: textureBindGroup,
      },
      ...(softResources === null || softBindGroup === null
        ? []
        : [
            {
              kind: "setBindGroup" as const,
              renderId: record.emitter.emitterId,
              index: 3,
              resourceKey: softResources.resourceKey,
              bindGroup: softBindGroup,
            },
          ]),
      {
        kind: "draw",
        renderId: record.emitter.emitterId,
        vertexCount: 6,
        instanceCount: drawInstanceCount,
        firstVertex: 0,
        firstInstance: 0,
      },
    );
  }

  mutableReport.textureResourcesCreated +=
    reuse.textureResourcesCreated - reuseStart.textureResourcesCreated;
  mutableReport.textureResourcesReused +=
    reuse.textureResourcesReused - reuseStart.textureResourcesReused;
  mutableReport.samplerResourcesCreated +=
    reuse.samplerResourcesCreated - reuseStart.samplerResourcesCreated;
  mutableReport.samplerResourcesReused +=
    reuse.samplerResourcesReused - reuseStart.samplerResourcesReused;
  mutableReport.staleStatesRemoved = cleanupParticleStates(
    options.cache,
    activeStateKeys,
  );
  mutableReport.staleStatesRemoved += cleanupParticleBurstCpuStates(
    options.cache,
    activeBurstCpuStateKeys,
  );
  mutableReport.staleStatesRemoved += cleanupParticleBurstBatchStates(
    options.cache,
    activeBurstBatchKeys,
  );

  return {
    valid: diagnostics.length === 0,
    commands,
    overlayCommands,
    diagnostics,
    report,
  };
}

async function prepareParticleEmitterFrameResources(options: {
  readonly app: WebGpuAppParticleContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly snapshot: RenderSnapshot;
  readonly emitter: ParticleEmitterPacket;
  readonly burstBatchable: boolean;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: unknown[];
  readonly renderPipelineFrameCache: Map<
    string,
    CreateParticleRenderPipelineResourceResult
  >;
  readonly textureSamplerFrameCache: Map<string, ParticleTextureSampler>;
  readonly emitterResourceFrameCache: Map<
    string,
    PreparedParticleEmitterFrameResources | null
  >;
}): Promise<PreparedParticleEmitterFrameResources | null> {
  const effectKey = assetHandleKey(options.emitter.effect);
  const cacheKey = `${effectKey}@${options.emitter.effectVersion}:${options.burstBatchable ? "burst" : "computed"}`;
  const cached = options.emitterResourceFrameCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const effectEntry = options.assets.get<
    "particle-effect",
    ParticleEffectAsset
  >(options.emitter.effect);
  const effect = effectEntry?.asset;

  if (
    effectEntry?.status !== "ready" ||
    effect === undefined ||
    effect === null
  ) {
    options.diagnostics.push({
      code: "particleFrame.effectNotReady",
      message: `Particle effect '${effectKey}' is not ready.`,
    });
    options.emitterResourceFrameCache.set(cacheKey, null);
    return null;
  }
  if (effect.type !== "emitter") {
    options.diagnostics.push({
      code: "particleFrame.compositeEffect",
      message: `Particle effect '${effectKey}' is composite; composites must be expanded into leaf emitter packets during extraction before reaching the renderer.`,
    });
    options.emitterResourceFrameCache.set(cacheKey, null);
    return null;
  }

  const renderPipelineMode = particlePipelineRenderMode(
    effect.runtime.renderMode,
  );
  const softResources = prepareParticleSoftResources({
    app: options.app,
    cache: options.cache,
    device: options.device,
    effect,
    emitter: options.emitter,
    snapshot: options.snapshot,
    diagnostics: options.diagnostics,
  });
  const softParticles = softResources !== null;
  const renderPipelineFrameKey = `${effect.runtime.blendMode}:${renderPipelineMode}:${options.burstBatchable ? "burst" : "computed"}:${softParticles ? "soft" : "hard"}`;
  let renderPipelineResult = options.renderPipelineFrameCache.get(
    renderPipelineFrameKey,
  );

  if (renderPipelineResult === undefined) {
    const pipelineResult = options.burstBatchable
      ? getOrCreateWebGpuAppParticleBurstRenderPipeline(
          options.app,
          options.cache,
          effect.runtime.blendMode,
          effect.runtime.renderMode,
          softParticles,
        )
      : getOrCreateWebGpuAppParticleRenderPipeline(
          options.app,
          options.cache,
          effect.runtime.blendMode,
          effect.runtime.renderMode,
          softParticles,
        );
    renderPipelineResult = isPromiseLike(pipelineResult)
      ? await pipelineResult
      : pipelineResult;
    options.renderPipelineFrameCache.set(
      renderPipelineFrameKey,
      renderPipelineResult,
    );
  }

  if (!renderPipelineResult.valid || renderPipelineResult.resource === null) {
    options.diagnostics.push(...renderPipelineResult.diagnostics);
    options.emitterResourceFrameCache.set(cacheKey, null);
    return null;
  }

  const renderPipelineResource = renderPipelineResult.resource;
  const renderPipeline = renderPipelineResource.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (renderPipeline.getBindGroupLayout === undefined) {
    options.diagnostics.push({
      code: "particleFrame.missingBindGroupSupport",
      message: "Particle render pipeline does not expose bind-group layouts.",
    });
    options.emitterResourceFrameCache.set(cacheKey, null);
    return null;
  }

  const textureSamplerCacheKey = particleTextureSamplerFrameCacheKey(effect);
  let textureSampler: ParticleTextureSampler | null =
    options.textureSamplerFrameCache.get(textureSamplerCacheKey) ?? null;

  if (textureSampler === null) {
    textureSampler = prepareParticleTextureSamplerResources({
      assets: options.assets,
      cache: options.cache,
      device: options.device,
      effect,
      reuse: options.reuse,
      diagnostics: options.diagnostics,
    });

    if (textureSampler !== null) {
      options.textureSamplerFrameCache.set(
        textureSamplerCacheKey,
        textureSampler,
      );
    }
  }

  if (textureSampler === null) {
    options.emitterResourceFrameCache.set(cacheKey, null);
    return null;
  }

  const prepared = {
    effectKey,
    effect,
    renderPipeline: renderPipeline as {
      readonly getBindGroupLayout: (group: number) => unknown;
    },
    renderPipelineResource,
    textureSampler,
    softResources,
  };

  options.emitterResourceFrameCache.set(cacheKey, prepared);
  return prepared;
}

function prepareParticleSoftResources(options: {
  readonly app: WebGpuAppParticleContext;
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly effect: ParticleEmitterEffectAsset;
  readonly emitter: ParticleEmitterPacket;
  readonly snapshot: RenderSnapshot;
  readonly diagnostics: unknown[];
}): ParticleSoftResources | null {
  if (options.effect.renderer.softParticles.enabled !== true) {
    return null;
  }
  if (options.app.msaa.sampleCount !== 1 || options.app.canvas === undefined) {
    return null;
  }

  const view = options.snapshot.views.find(
    (candidate) => candidate.viewId === options.emitter.sortKey.viewId,
  );

  if (view?.renderTarget !== null) {
    return null;
  }

  const device = options.device as Parameters<
    typeof createOrReuseWebGpuDepthTexture
  >[0]["device"] &
    Parameters<typeof createWebGpuBuffer>[0]["device"];

  if (typeof device.createTexture !== "function") {
    return null;
  }

  const dimensions = webGpuAppCanvasDimensions(options.app.canvas);
  const depth = createOrReuseWebGpuDepthTexture({
    device,
    cache: options.cache.depth,
    width: dimensions.width,
    height: dimensions.height,
    format: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: 1,
  }).resource;
  const nearFade = Math.max(
    0,
    finiteOrZero(options.effect.renderer.softParticles.nearFade),
  );
  const farFade = Math.max(
    nearFade + 0.000001,
    finiteOrZero(options.effect.renderer.softParticles.farFade),
  );
  const params = getOrCreateParticleSoftParams({
    cache: options.cache,
    device,
    nearFade,
    farFade,
    diagnostics: options.diagnostics,
  });

  if (params === null) {
    return null;
  }

  return {
    resourceKey: `${params.key}:depth:${dimensions.width}x${dimensions.height}`,
    depthView: depth.view,
    paramsBuffer: params.buffer,
  };
}

function getOrCreateParticleSoftParams(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: Parameters<typeof createWebGpuBuffer>[0]["device"];
  readonly nearFade: number;
  readonly farFade: number;
  readonly diagnostics: unknown[];
}): ParticleSoftParamsResource | null {
  const key = `particle:soft:${options.nearFade}:${options.farFade}`;
  const cached = options.cache.particleSoftParams.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const data = new Float32Array([options.nearFade, options.farFade, 0, 0]);
  const created = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: `Particle/SoftParams/${key}`,
      size: data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: data,
    },
  });

  if (!created.ok) {
    options.diagnostics.push({
      code: "particleFrame.softParamsFailed",
      message: created.message,
    });
    return null;
  }

  const resource: ParticleSoftParamsResource = {
    key,
    buffer: created.buffer,
    byteLength: data.byteLength,
  };

  options.cache.particleSoftParams.set(key, resource);
  return resource;
}

function createParticleSoftBindGroup(options: {
  readonly device: {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  };
  readonly renderPipeline: {
    readonly getBindGroupLayout: (group: number) => unknown;
  };
  readonly emitterId: number;
  readonly groupIndex: number;
  readonly softResources: ParticleSoftResources;
}): unknown | null {
  const createBindGroup = options.device.createBindGroup;

  if (createBindGroup === undefined) {
    return null;
  }

  return createBindGroup({
    label: `Particle/SoftBindGroup/${options.emitterId}`,
    layout: options.renderPipeline.getBindGroupLayout(options.groupIndex),
    entries: [
      { binding: 0, resource: options.softResources.depthView },
      { binding: 1, resource: { buffer: options.softResources.paramsBuffer } },
    ],
  });
}

function firstSoftParticleRecord(
  unit: ParticleBurstBatchUnit,
): PreparedParticleEmitterRecord | null {
  return unit.records[0] ?? null;
}

function isBatchableParticleBurst(emitter: ParticleEmitterPacket): boolean {
  return (
    emitter.mode === "burst" &&
    emitter.burst !== undefined &&
    emitter.simulationSpace === "world" &&
    emitter.capacity > 0
  );
}

function particleTextureSamplerFrameCacheKey(
  effect: ParticleEmitterEffectAsset,
): string {
  const textureKey =
    effect.runtime.texture === undefined || effect.runtime.texture === null
      ? PARTICLE_DEFAULT_TEXTURE_CACHE_KEY
      : assetHandleKey(effect.runtime.texture);
  const samplerKey =
    effect.runtime.sampler === undefined || effect.runtime.sampler === null
      ? PARTICLE_DEFAULT_SAMPLER_CACHE_KEY
      : assetHandleKey(effect.runtime.sampler);

  return `${textureKey}:${samplerKey}`;
}

function particleBurstBatchUnitKey(
  record: PreparedParticleEmitterRecord,
): string {
  const { emitter, textureSampler } = record;

  return [
    "particle-burst-batch",
    `effect:${record.effectKey}@${emitter.effectVersion}`,
    `pipeline:${record.renderPipelineResource.cacheKey}`,
    `texture:${textureSampler.textureKey}`,
    `sampler:${textureSampler.samplerKey}`,
    `view:${emitter.sortKey.viewId}`,
    `layer-mask:${emitter.layerMask}`,
    `sort-layer:${emitter.sortKey.layer}`,
    `order:${emitter.sortKey.order}`,
  ].join("|");
}

function writeParticleBurstBatchCommands(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: Parameters<typeof createWebGpuBuffer>[0]["device"] & {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
    readonly queue?: {
      readonly writeBuffer?: (
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => void;
    };
  };
  readonly viewBuffer: unknown;
  readonly frame: number;
  readonly time: number;
  readonly unit: ParticleBurstBatchUnit;
  readonly activeBurstCpuStateKeys: Set<string>;
  readonly activeBurstBatchKeys: Set<string>;
  readonly commands: RenderPassCommand[];
}): {
  readonly liveParticles: number;
  readonly statesCreated: number;
  readonly statesReused: number;
  readonly diagnostics: readonly unknown[];
} {
  const first = options.unit.records[0];

  if (first === undefined) {
    return {
      liveParticles: 0,
      statesCreated: 0,
      statesReused: 0,
      diagnostics: [],
    };
  }

  if (
    options.device.createBindGroup === undefined ||
    options.device.queue?.writeBuffer === undefined
  ) {
    return {
      liveParticles: 0,
      statesCreated: 0,
      statesReused: 0,
      diagnostics: [
        {
          code: "particleFrame.burstBatchUnavailable",
          message:
            "Particle burst batching requires bind groups and queue.writeBuffer.",
        },
      ],
    };
  }

  const diagnostics: unknown[] = [];
  const liveSlices: {
    readonly key: string;
    readonly cpu: ParticleEmitterCpuStateResource;
    readonly emitter: ParticleEmitterPacket;
    readonly effect: ParticleEmitterEffectAsset;
    readonly liveParticles: number;
    readonly capacity: number;
  }[] = [];
  let totalCapacity = 0;
  let totalLiveParticles = 0;
  let statesCreated = 0;
  let statesReused = 0;

  for (const record of options.unit.records) {
    const capacity = Math.max(0, Math.trunc(record.emitter.capacity));
    totalCapacity += capacity;
    const cpuState = getOrCreateParticleBurstCpuState({
      cache: options.cache,
      emitter: record.emitter,
    });
    const slotKey = cpuState.key;

    options.activeBurstCpuStateKeys.add(cpuState.key);
    statesCreated += cpuState.created ? 1 : 0;
    statesReused += cpuState.created ? 0 : 1;

    const update = updateParticleBurstAnalyticCpuData({
      cpu: cpuState.cpu,
      emitter: record.emitter,
      effect: record.effect,
      time: options.time,
    });

    diagnostics.push(...update.diagnostics);

    if (update.liveParticles <= 0) {
      continue;
    }

    totalLiveParticles += update.liveParticles;
    liveSlices.push({
      key: slotKey,
      cpu: cpuState.cpu,
      emitter: record.emitter,
      effect: record.effect,
      liveParticles: update.liveParticles,
      capacity,
    });
  }

  if (totalLiveParticles <= 0) {
    return {
      liveParticles: 0,
      statesCreated,
      statesReused,
      diagnostics,
    };
  }

  const batchState = getOrCreateParticleBurstBatchGpuState({
    cache: options.cache,
    device: options.device,
    key: options.unit.key,
    capacity: Math.max(totalCapacity, totalLiveParticles),
  });

  if (!batchState.valid || batchState.state === null) {
    return {
      liveParticles: 0,
      statesCreated,
      statesReused,
      diagnostics: [...diagnostics, ...batchState.diagnostics],
    };
  }

  options.activeBurstBatchKeys.add(batchState.state.key);
  statesCreated += batchState.created ? 1 : 0;
  statesReused += batchState.created ? 0 : 1;

  const activeDrawRanges: {
    readonly firstInstance: number;
    readonly instanceCount: number;
  }[] = [];
  resetParticleBurstBatchSlots(batchState.state);
  const uploadRanges: { byteOffset: number; byteLength: number }[] = [];
  for (const slice of liveSlices) {
    const slot = acquireParticleBurstBatchSlot(
      batchState.state,
      slice.key,
      slice.capacity,
    );

    if (slot === null) {
      diagnostics.push({
        code: "particleFrame.burstBatchSlotUnavailable",
        message:
          "Particle burst batch did not have enough contiguous slot capacity.",
      });
      continue;
    }

    const upload = writeParticleBurstInitialSlotData({
      state: batchState.state,
      slot: slot.slot,
      cpu: slice.cpu,
      emitter: slice.emitter,
    });

    uploadRanges.push(upload);

    activeDrawRanges.push({
      firstInstance: slot.slot.offset,
      instanceCount: slot.slot.capacity,
    });
  }

  const drawRanges = particleBurstDrawEnvelope(activeDrawRanges);

  if (drawRanges.length === 0) {
    return {
      liveParticles: totalLiveParticles,
      statesCreated,
      statesReused,
      diagnostics,
    };
  }

  for (const upload of mergeParticleBurstUploadRanges(uploadRanges)) {
    options.device.queue.writeBuffer(
      batchState.state.particleBuffer,
      upload.byteOffset,
      batchState.state.bufferData.buffer,
      batchState.state.bufferData.byteOffset + upload.byteOffset,
      upload.byteLength,
    );
  }

  const params = getOrUpdateParticleBurstRenderParams({
    device: options.device,
    state: batchState.state,
    effect: first.effect,
    time: options.time,
  });

  if (!params.valid) {
    return {
      liveParticles: 0,
      statesCreated,
      statesReused,
      diagnostics: [...diagnostics, ...params.diagnostics],
    };
  }

  if (params.buffer === null) {
    return {
      liveParticles: 0,
      statesCreated,
      statesReused,
      diagnostics: [
        ...diagnostics,
        {
          code: "particleFrame.burstParamBufferMissing",
          message: "Particle burst render params did not return a buffer.",
        },
      ],
    };
  }

  const viewBindGroup = options.device.createBindGroup({
    label: `Particle/BurstBatchViewBindGroup/${first.emitter.emitterId}`,
    layout: first.renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: options.viewBuffer } }],
  });
  const particleBindGroup = options.device.createBindGroup({
    label: `Particle/BurstBatchRenderBindGroup/${first.emitter.emitterId}`,
    layout: first.renderPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: batchState.state.particleBuffer } },
    ],
  });
  const textureBindGroup = options.device.createBindGroup({
    label: `Particle/BurstBatchTextureBindGroup/${first.emitter.emitterId}`,
    layout: first.renderPipeline.getBindGroupLayout(2),
    entries: [
      { binding: 0, resource: first.textureSampler.texture.view },
      { binding: 1, resource: first.textureSampler.sampler.sampler },
    ],
  });
  const paramsBindGroup = options.device.createBindGroup({
    label: `Particle/BurstBatchParamsBindGroup/${first.emitter.emitterId}`,
    layout: first.renderPipeline.getBindGroupLayout(3),
    entries: [{ binding: 0, resource: { buffer: params.buffer } }],
  });
  const softResources = first.softResources;
  const softBindGroup =
    softResources === null
      ? null
      : createParticleSoftBindGroup({
          device: options.device,
          renderPipeline: first.renderPipeline,
          emitterId: first.emitter.emitterId,
          groupIndex: 4,
          softResources,
        });

  options.commands.push(
    {
      kind: "setPipeline",
      renderId: first.emitter.emitterId,
      pipelineKey: first.renderPipelineResource.cacheKey,
      pipeline: first.renderPipelineResource.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 0,
      resourceKey: `particle:view:${options.frame}`,
      bindGroup: viewBindGroup,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 1,
      resourceKey: batchState.state.key,
      bindGroup: particleBindGroup,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 2,
      resourceKey: `${first.textureSampler.textureKey}:${first.textureSampler.samplerKey}`,
      bindGroup: textureBindGroup,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 3,
      resourceKey: `${batchState.state.key}:params`,
      bindGroup: paramsBindGroup,
    },
    ...(softResources === null || softBindGroup === null
      ? []
      : [
          {
            kind: "setBindGroup" as const,
            renderId: first.emitter.emitterId,
            index: 4,
            resourceKey: softResources.resourceKey,
            bindGroup: softBindGroup,
          },
        ]),
  );

  for (const range of drawRanges) {
    options.commands.push({
      kind: "draw",
      renderId: first.emitter.emitterId,
      vertexCount: 6,
      instanceCount: range.instanceCount,
      firstVertex: 0,
      firstInstance: range.firstInstance,
    });
  }

  return {
    liveParticles: totalLiveParticles,
    statesCreated,
    statesReused,
    diagnostics,
  };
}

function particleBurstDrawEnvelope(
  ranges: readonly {
    readonly firstInstance: number;
    readonly instanceCount: number;
  }[],
): readonly {
  readonly firstInstance: number;
  readonly instanceCount: number;
}[] {
  let start = Number.POSITIVE_INFINITY;
  let end = 0;

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (range === undefined || range.instanceCount <= 0) {
      continue;
    }

    const rangeEnd = range.firstInstance + range.instanceCount;
    start = Math.min(start, range.firstInstance);
    end = Math.max(end, rangeEnd);
  }

  if (!Number.isFinite(start) || end <= start) {
    return [];
  }

  return [{ firstInstance: start, instanceCount: end - start }];
}

function prepareParticleTextureSamplerResources(options: {
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly effect: ParticleEmitterEffectAsset;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: unknown[];
}): ParticleTextureSampler | null {
  const texture =
    options.effect.runtime.texture === undefined ||
    options.effect.runtime.texture === null
      ? getOrCreateDefaultParticleTexture({
          cache: options.cache,
          device: options.device,
          reuse: options.reuse,
          diagnostics: options.diagnostics,
        })
      : prepareAppTextureResource({
          assets: options.assets,
          device: options.device,
          cache: options.cache,
          handle: options.effect.runtime.texture,
          reuse: options.reuse,
          diagnostics: options.diagnostics as Parameters<
            typeof prepareAppTextureResource
          >[0]["diagnostics"],
        });
  const sampler =
    options.effect.runtime.sampler === undefined ||
    options.effect.runtime.sampler === null
      ? getOrCreateDefaultParticleSampler({
          cache: options.cache,
          device: options.device,
          reuse: options.reuse,
          diagnostics: options.diagnostics,
        })
      : prepareAppSamplerResource({
          assets: options.assets,
          device: options.device,
          cache: options.cache,
          handle: options.effect.runtime.sampler,
          reuse: options.reuse,
          diagnostics: options.diagnostics as Parameters<
            typeof prepareAppSamplerResource
          >[0]["diagnostics"],
        });

  if (texture === null || sampler === null) {
    return null;
  }

  return {
    texture: texture.resource,
    sampler: sampler.resource,
    textureKey: texture.cacheKey,
    samplerKey: sampler.cacheKey,
  };
}

function getOrCreateDefaultParticleTexture(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: unknown[];
}): {
  readonly cacheKey: string;
  readonly resource: TextureGpuResource;
} | null {
  const cached = options.cache.textures.get(PARTICLE_DEFAULT_TEXTURE_CACHE_KEY);

  if (cached !== undefined) {
    options.reuse.textureResourcesReused += 1;
    return {
      cacheKey: PARTICLE_DEFAULT_TEXTURE_CACHE_KEY,
      resource: cached,
    };
  }

  const result = createTextureGpuResource({
    device: options.device as Parameters<
      typeof createTextureGpuResource
    >[0]["device"],
    resourceKey: "texture:__aperture_particle_default_white",
    descriptor: {
      label: "Particle default white texture",
      size: [1, 1, 1],
      format: "rgba8unorm-srgb",
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
      colorSpace: "srgb",
      semantic: "base-color",
      mipLevelCount: 1,
    },
    upload: {
      data: new Uint8Array([255, 255, 255, 255]),
      bytesPerRow: 4,
    },
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  options.cache.textures.set(
    PARTICLE_DEFAULT_TEXTURE_CACHE_KEY,
    result.resource,
  );
  options.reuse.textureResourcesCreated += 1;
  return {
    cacheKey: PARTICLE_DEFAULT_TEXTURE_CACHE_KEY,
    resource: result.resource,
  };
}

function getOrCreateDefaultParticleSampler(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: unknown[];
}): {
  readonly cacheKey: string;
  readonly resource: SamplerGpuResource;
} | null {
  const cached = options.cache.samplers.get(PARTICLE_DEFAULT_SAMPLER_CACHE_KEY);

  if (cached !== undefined) {
    options.reuse.samplerResourcesReused += 1;
    return {
      cacheKey: PARTICLE_DEFAULT_SAMPLER_CACHE_KEY,
      resource: cached,
    };
  }

  const result = createSamplerGpuResource({
    device: options.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey: "sampler:__aperture_particle_default_linear",
    sampler: createSamplerAsset({
      label: "Particle default linear sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  options.cache.samplers.set(
    PARTICLE_DEFAULT_SAMPLER_CACHE_KEY,
    result.resource,
  );
  options.reuse.samplerResourcesCreated += 1;
  return {
    cacheKey: PARTICLE_DEFAULT_SAMPLER_CACHE_KEY,
    resource: result.resource,
  };
}

function getOrCreateParticleEmitterGpuState(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: Parameters<typeof createWebGpuBuffer>[0]["device"];
  readonly emitter: ParticleEmitterPacket;
}): {
  readonly valid: boolean;
  readonly state: ParticleEmitterGpuStateResource | null;
  readonly created: boolean;
  readonly diagnostics: readonly unknown[];
} {
  const key = particleEmitterStateKey(options.emitter);
  const cached = options.cache.particleEmitterStates.get(key);

  if (cached !== undefined) {
    return { valid: true, state: cached, created: false, diagnostics: [] };
  }

  const byteLength = options.emitter.capacity * PARTICLE_DATA_FLOAT_STRIDE * 4;
  const zero = new Float32Array(
    options.emitter.capacity * PARTICLE_DATA_FLOAT_STRIDE,
  );
  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: `Particle/State/${options.emitter.emitterId}`,
      size: byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: zero,
    },
  });

  if (!buffer.ok) {
    return {
      valid: false,
      state: null,
      created: false,
      diagnostics: [
        {
          code: "particleFrame.stateBufferFailed",
          message: buffer.message,
        },
      ],
    };
  }

  const state: ParticleEmitterGpuStateResource = {
    key,
    emitterId: options.emitter.emitterId,
    effectVersion: options.emitter.effectVersion,
    capacity: options.emitter.capacity,
    resetEpoch: options.emitter.resetEpoch,
    particleBuffer: buffer.buffer,
    byteLength,
    cpu: createParticleEmitterCpuState(options.emitter.capacity),
  };

  options.cache.particleEmitterStates.set(key, state);
  return { valid: true, state, created: true, diagnostics: [] };
}

function getOrCreateParticleBurstCpuState(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly emitter: ParticleEmitterPacket;
}): {
  readonly key: string;
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly created: boolean;
} {
  const key = particleEmitterStateKey(options.emitter);
  const cached = options.cache.particleBurstCpuStates.get(key);

  if (cached !== undefined) {
    return { key, cpu: cached, created: false };
  }

  const cpu = createParticleEmitterCpuState(options.emitter.capacity);

  options.cache.particleBurstCpuStates.set(key, cpu);
  return { key, cpu, created: true };
}

function getOrCreateParticleBurstBatchGpuState(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: Parameters<typeof createWebGpuBuffer>[0]["device"];
  readonly key: string;
  readonly capacity: number;
}): {
  readonly valid: boolean;
  readonly state: ParticleBurstBatchGpuStateResource | null;
  readonly created: boolean;
  readonly diagnostics: readonly unknown[];
} {
  const capacity = nextPowerOfTwo(Math.max(1, Math.trunc(options.capacity)));
  const cached = options.cache.particleBurstBatchStates.get(options.key);

  if (cached !== undefined && cached.capacity >= capacity) {
    return { valid: true, state: cached, created: false, diagnostics: [] };
  }

  if (cached !== undefined) {
    destroyWebGpuBuffer(cached.particleBuffer);
  }

  const byteLength = capacity * PARTICLE_BURST_DATA_FLOAT_STRIDE * 4;
  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: `Particle/BurstBatch/${options.key}`,
      size: byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
    },
  });

  if (!buffer.ok) {
    return {
      valid: false,
      state: null,
      created: false,
      diagnostics: [
        {
          code: "particleFrame.burstBatchBufferFailed",
          message: buffer.message,
        },
      ],
    };
  }

  const state: ParticleBurstBatchGpuStateResource = {
    key: options.key,
    capacity,
    particleBuffer: buffer.buffer,
    byteLength,
    bufferData: new Float32Array(capacity * PARTICLE_BURST_DATA_FLOAT_STRIDE),
    slotsByBurstKey: new Map(),
    freeSlots: [],
    nextParticleSlot: 0,
    paramBuffer: null,
    paramByteLength: 0,
    paramData: null,
  };

  options.cache.particleBurstBatchStates.set(options.key, state);
  return { valid: true, state, created: true, diagnostics: [] };
}

function resetParticleBurstBatchSlots(
  state: ParticleBurstBatchGpuStateResource,
): void {
  state.slotsByBurstKey.clear();
  state.freeSlots.length = 0;
  state.nextParticleSlot = 0;
}

function acquireParticleBurstBatchSlot(
  state: ParticleBurstBatchGpuStateResource,
  key: string,
  capacity: number,
): { readonly slot: ParticleBurstBatchSlot; readonly created: boolean } | null {
  const cached = state.slotsByBurstKey.get(key);

  if (cached !== undefined) {
    return { slot: cached, created: false };
  }

  const requestedCapacity = Math.max(1, Math.trunc(capacity));

  for (let index = 0; index < state.freeSlots.length; index += 1) {
    const free = state.freeSlots[index];

    if (free === undefined || free.capacity < requestedCapacity) {
      continue;
    }

    state.freeSlots.splice(index, 1);

    if (free.capacity > requestedCapacity) {
      state.freeSlots.push({
        offset: free.offset + requestedCapacity,
        capacity: free.capacity - requestedCapacity,
      });
    }

    const slot: ParticleBurstBatchSlot = {
      key,
      offset: free.offset,
      capacity: requestedCapacity,
    };

    state.slotsByBurstKey.set(key, slot);
    return { slot, created: true };
  }

  if (state.nextParticleSlot + requestedCapacity > state.capacity) {
    return null;
  }

  const slot: ParticleBurstBatchSlot = {
    key,
    offset: state.nextParticleSlot,
    capacity: requestedCapacity,
  };

  state.nextParticleSlot += requestedCapacity;
  state.slotsByBurstKey.set(key, slot);
  return { slot, created: true };
}

function writeParticleBurstInitialSlotData(options: {
  readonly state: ParticleBurstBatchGpuStateResource;
  readonly slot: ParticleBurstBatchSlot;
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
}): { readonly byteOffset: number; readonly byteLength: number } {
  const startFloat = options.slot.offset * PARTICLE_BURST_DATA_FLOAT_STRIDE;
  const particleCount = Math.min(
    options.slot.capacity,
    options.cpu.ages.length,
  );

  for (let index = 0; index < particleCount; index += 1) {
    const sourceOffset = index * 3;
    const outputOffset = startFloat + index * PARTICLE_BURST_DATA_FLOAT_STRIDE;

    options.state.bufferData[outputOffset] =
      options.cpu.positions[sourceOffset] ?? 0;
    options.state.bufferData[outputOffset + 1] =
      options.cpu.positions[sourceOffset + 1] ?? 0;
    options.state.bufferData[outputOffset + 2] =
      options.cpu.positions[sourceOffset + 2] ?? 0;
    options.state.bufferData[outputOffset + 3] = options.cpu.startTime;
    options.state.bufferData[outputOffset + 4] =
      options.cpu.velocities[sourceOffset] ?? 0;
    options.state.bufferData[outputOffset + 5] =
      options.cpu.velocities[sourceOffset + 1] ?? 0;
    options.state.bufferData[outputOffset + 6] =
      options.cpu.velocities[sourceOffset + 2] ?? 0;
    options.state.bufferData[outputOffset + 7] =
      options.cpu.lifetimes[index] ?? 0.001;
    options.state.bufferData[outputOffset + 8] =
      options.cpu.baseSizes[index] ?? 1;
    options.state.bufferData[outputOffset + 9] = options.emitter.timeScale;
    options.state.bufferData[outputOffset + 10] =
      options.cpu.rotations[index] ?? 0;
    options.state.bufferData[outputOffset + 11] =
      options.cpu.angularVelocities[index] ?? 0;
  }

  const byteOffset = startFloat * Float32Array.BYTES_PER_ELEMENT;
  const byteLength =
    particleCount *
    PARTICLE_BURST_DATA_FLOAT_STRIDE *
    Float32Array.BYTES_PER_ELEMENT;

  return { byteOffset, byteLength };
}

function mergeParticleBurstUploadRanges(
  ranges: readonly {
    readonly byteOffset: number;
    readonly byteLength: number;
  }[],
): readonly { readonly byteOffset: number; readonly byteLength: number }[] {
  if (ranges.length <= 1) {
    return ranges;
  }

  const sorted = particleBurstUploadRangesAreOrdered(ranges)
    ? ranges
    : [...ranges].sort((a, b) => a.byteOffset - b.byteOffset);
  const merged: { byteOffset: number; byteLength: number }[] = [];
  let currentOffset = sorted[0]?.byteOffset ?? 0;
  let currentEnd = currentOffset + (sorted[0]?.byteLength ?? 0);

  for (let index = 1; index < sorted.length; index += 1) {
    const range = sorted[index];

    if (range === undefined) {
      continue;
    }

    const rangeEnd = range.byteOffset + range.byteLength;

    if (range.byteOffset <= currentEnd) {
      currentEnd = Math.max(currentEnd, rangeEnd);
      continue;
    }

    merged.push({
      byteOffset: currentOffset,
      byteLength: currentEnd - currentOffset,
    });
    currentOffset = range.byteOffset;
    currentEnd = rangeEnd;
  }

  merged.push({
    byteOffset: currentOffset,
    byteLength: currentEnd - currentOffset,
  });
  return merged;
}

function particleBurstUploadRangesAreOrdered(
  ranges: readonly {
    readonly byteOffset: number;
    readonly byteLength: number;
  }[],
): boolean {
  let previous = ranges[0]?.byteOffset ?? 0;

  for (let index = 1; index < ranges.length; index += 1) {
    const current = ranges[index]?.byteOffset ?? previous;

    if (current < previous) {
      return false;
    }

    previous = current;
  }

  return true;
}

function getOrUpdateParticleBurstRenderParams(options: {
  readonly device: Parameters<typeof createWebGpuBuffer>[0]["device"] & {
    readonly queue?: {
      readonly writeBuffer?: (
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => void;
    };
  };
  readonly state: ParticleBurstBatchGpuStateResource;
  readonly effect: ParticleEmitterEffectAsset;
  readonly time: number;
}): {
  readonly valid: boolean;
  readonly buffer: unknown | null;
  readonly diagnostics: readonly unknown[];
} {
  if (options.device.queue?.writeBuffer === undefined) {
    return {
      valid: false,
      buffer: null,
      diagnostics: [
        {
          code: "particleFrame.burstParamWriteUnavailable",
          message: "Particle burst render params require queue.writeBuffer.",
        },
      ],
    };
  }

  const data =
    options.state.paramData?.length === PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT
      ? options.state.paramData
      : new Float32Array(PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT);

  data[0] = options.time;
  data[1] = options.effect.runtime.gravity[0];
  data[2] = options.effect.runtime.gravity[1];
  data[3] = options.effect.runtime.gravity[2];
  data[4] = options.effect.runtime.linearDamping;
  data[5] = 0;
  data[6] = 0;
  data[7] = 0;
  data[PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET] =
    options.effect.runtime.textureSheetTiles[0];
  data[PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET + 1] =
    options.effect.runtime.textureSheetTiles[1];
  data[PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET + 2] =
    options.effect.runtime.textureSheetStartFrame;
  data[PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET + 3] =
    options.effect.runtime.textureSheetCycleCount;
  writeParticleBurstRenderCurveData(data, options.effect);

  if (
    options.state.paramBuffer !== null &&
    options.state.paramByteLength === data.byteLength
  ) {
    options.device.queue.writeBuffer(
      options.state.paramBuffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    options.state.paramData = data;
    return {
      valid: true,
      buffer: options.state.paramBuffer,
      diagnostics: [],
    };
  }

  if (options.state.paramBuffer !== null) {
    destroyWebGpuBuffer(options.state.paramBuffer);
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: `Particle/BurstBatchParams/${options.state.key}`,
      size: data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: data,
    },
  });

  if (!buffer.ok) {
    return {
      valid: false,
      buffer: null,
      diagnostics: [
        {
          code: "particleFrame.burstParamBufferFailed",
          message: buffer.message,
        },
      ],
    };
  }

  options.state.paramBuffer = buffer.buffer;
  options.state.paramByteLength = data.byteLength;
  options.state.paramData = data;
  return { valid: true, buffer: buffer.buffer, diagnostics: [] };
}

function createParticleEmitterCpuState(
  capacity: number,
): ParticleEmitterCpuStateResource {
  return {
    positions: new Float32Array(capacity * 3),
    velocities: new Float32Array(capacity * 3),
    rotations: new Float32Array(capacity),
    angularVelocities: new Float32Array(capacity),
    ages: new Float32Array(capacity),
    lifetimes: new Float32Array(capacity),
    baseSizes: new Float32Array(capacity),
    bufferData: new Float32Array(capacity * PARTICLE_DATA_FLOAT_STRIDE),
    initialized: false,
    startTime: 0,
    lastTime: 0,
    liveCount: 0,
    maxLifetime: 0,
    uniformLifetime: false,
    spawnAccumulator: 0,
    distanceAccumulator: 0,
    lastOriginX: 0,
    lastOriginY: 0,
    lastOriginZ: 0,
    hasLastOrigin: false,
    spawnCursor: 0,
    spawnSerial: 0,
  };
}

function updateParticleBurstAnalyticCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  if (options.emitter.burst === undefined) {
    return {
      liveParticles: 0,
      diagnostics: [
        {
          code: "particleFrame.burstStateMissing",
          message: "Particle burst packet is missing burst parameters.",
        },
      ],
    };
  }

  ensureParticleBurstCpuInitialized(options);

  const elapsed = Math.max(0, options.time - options.cpu.startTime);
  const scaledElapsed = elapsed * options.emitter.timeScale;
  const maxLifetime = Math.max(options.cpu.maxLifetime, 0.001);

  if (options.cpu.uniformLifetime) {
    const live = scaledElapsed < maxLifetime ? options.cpu.lifetimes.length : 0;

    options.cpu.liveCount = live;
    return { liveParticles: live, diagnostics: [] };
  }

  let live = 0;

  for (let index = 0; index < options.cpu.lifetimes.length; index += 1) {
    if (scaledElapsed < (options.cpu.lifetimes[index] ?? 0)) {
      live += 1;
    }
  }

  options.cpu.liveCount = live;
  return { liveParticles: live, diagnostics: [] };
}

function updateParticleBurstCpuState(options: {
  readonly device: {
    readonly queue?: {
      readonly writeBuffer?: (
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => void;
    };
  };
  readonly state: ParticleEmitterGpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  const cpu = options.state.cpu;

  if (cpu === undefined) {
    return {
      liveParticles: 0,
      diagnostics: [
        {
          code: "particleFrame.burstStateMissing",
          message: "Particle burst packet is missing renderer CPU state.",
        },
      ],
    };
  }

  if (options.device.queue?.writeBuffer === undefined) {
    return {
      liveParticles: 0,
      diagnostics: [
        {
          code: "particleFrame.burstWriteBufferUnavailable",
          message: "Particle burst simulation requires queue.writeBuffer.",
        },
      ],
    };
  }

  const update = updateParticleBurstCpuData({
    cpu,
    emitter: options.emitter,
    effect: options.effect,
    time: options.time,
  });

  if (update.liveParticles > 0) {
    options.device.queue.writeBuffer(
      options.state.particleBuffer,
      0,
      cpu.bufferData.buffer,
      cpu.bufferData.byteOffset,
      update.liveParticles * PARTICLE_DATA_FLOAT_STRIDE * 4,
    );
  }

  return update;
}

function updateParticleContinuousCpuState(options: {
  readonly device: {
    readonly queue?: {
      readonly writeBuffer?: (
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => void;
    };
  };
  readonly state: ParticleEmitterGpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  const cpu = options.state.cpu;

  if (cpu === undefined) {
    return {
      liveParticles: 0,
      diagnostics: [
        {
          code: "particleFrame.continuousStateMissing",
          message:
            "Continuous particle emitter is missing renderer lifecycle state.",
        },
      ],
    };
  }

  if (options.device.queue?.writeBuffer === undefined) {
    return {
      liveParticles: 0,
      diagnostics: [
        {
          code: "particleFrame.continuousWriteBufferUnavailable",
          message: "Continuous particle simulation requires queue.writeBuffer.",
        },
      ],
    };
  }

  const update = updateParticleContinuousCpuData({
    cpu,
    emitter: options.emitter,
    effect: options.effect,
    snapshot: options.snapshot,
    time: options.time,
  });

  if (update.liveParticles > 0) {
    options.device.queue.writeBuffer(
      options.state.particleBuffer,
      0,
      cpu.bufferData.buffer,
      cpu.bufferData.byteOffset,
      update.liveParticles * PARTICLE_DATA_FLOAT_STRIDE * 4,
    );
  }

  return update;
}

function updateParticleContinuousCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  ensureParticleContinuousCpuInitialized(options);

  const rawDelta = options.time - options.cpu.lastTime;
  const delta =
    !Number.isFinite(rawDelta) || rawDelta <= 0
      ? 0
      : Math.min(rawDelta, 1 / 15) *
        options.emitter.timeScale *
        options.effect.runtime.simulationSpeed;

  options.cpu.lastTime = options.time;
  spawnParticleContinuousCpuData({ ...options, delta });
  const liveParticles = writeParticleCpuBuffer({
    cpu: options.cpu,
    effect: options.effect,
    delta,
    origin: emitterWorldOrigin(options.snapshot, options.emitter),
    applyContinuousModules: true,
  });

  return { liveParticles, diagnostics: [] };
}

function updateParticleBurstCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  if (options.emitter.burst === undefined) {
    return {
      liveParticles: 0,
      diagnostics: [
        {
          code: "particleFrame.burstStateMissing",
          message: "Particle burst packet is missing burst parameters.",
        },
      ],
    };
  }

  ensureParticleBurstCpuInitialized(options);

  const rawDelta = options.time - options.cpu.lastTime;
  const delta =
    !Number.isFinite(rawDelta) || rawDelta <= 0
      ? 0
      : Math.min(rawDelta, 1 / 15) * options.emitter.timeScale;
  options.cpu.lastTime = options.time;

  const liveParticles = writeParticleCpuBuffer({
    cpu: options.cpu,
    effect: options.effect,
    delta,
    origin: [0, 0, 0],
    applyContinuousModules: false,
  });

  return { liveParticles, diagnostics: [] };
}

function ensureParticleContinuousCpuInitialized(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
}): void {
  if (options.cpu.initialized) {
    return;
  }

  options.cpu.initialized = true;
  options.cpu.startTime = 0;
  options.cpu.lastTime = 0;

  if (options.effect.runtime.prewarm && options.effect.runtime.looping) {
    prewarmParticleContinuousCpuData(options);
  }
}

function prewarmParticleContinuousCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
}): void {
  const duration = Math.max(0, options.effect.runtime.duration);
  const targetCount = Math.min(
    options.emitter.capacity,
    Math.floor(options.effect.runtime.emissionRate * duration),
  );

  for (let index = 0; index < targetCount; index += 1) {
    spawnParticleContinuousSlot({
      cpu: options.cpu,
      emitter: options.emitter,
      effect: options.effect,
      snapshot: options.snapshot,
      index,
      ageT: targetCount <= 1 ? 0 : index / (targetCount - 1),
    });
  }
}

function spawnParticleContinuousCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
  readonly delta: number;
}): void {
  if (options.delta <= 0) {
    return;
  }

  const hasRate =
    options.effect.runtime.emissionRate > 0 ||
    options.effect.runtime.emissionRateOverDistance > 0;
  const hasBursts = options.effect.runtime.bursts.length > 0;

  if (!hasRate && !hasBursts) {
    return;
  }

  const elapsed = Math.max(
    0,
    (options.time - options.cpu.startTime) *
      options.emitter.timeScale *
      options.effect.runtime.simulationSpeed,
  );
  // Composite child emitters add their authored delay on top of the effect's
  // own start delay, and an authored duration acts as a hard emission cutoff
  // (even for looping effects).
  const startDelay =
    options.effect.runtime.startDelay + Math.max(0, options.emitter.delay ?? 0);
  if (elapsed < startDelay) {
    return;
  }

  const localTime = elapsed - startDelay;
  const childDuration = options.emitter.duration;
  const withinChildWindow =
    childDuration === undefined ||
    childDuration === null ||
    localTime <= childDuration;
  const duration = Math.max(0.001, options.effect.runtime.duration);
  const emitting =
    withinChildWindow &&
    (options.effect.runtime.looping ||
      localTime <= options.effect.runtime.duration);

  if (!emitting) {
    return;
  }

  const loopTime = options.effect.runtime.looping
    ? localTime % duration
    : localTime;

  if (loopTime < options.delta && localTime > options.delta) {
    options.cpu.spawnAccumulator = 0;
  }

  const previousLocalTime = Math.max(0, localTime - options.delta);
  const previousLoopTime = options.effect.runtime.looping
    ? positiveModulo(previousLocalTime, duration)
    : previousLocalTime;
  const distance = particleEmitterTravelDistance(options);

  options.cpu.spawnAccumulator +=
    options.effect.runtime.emissionRate * options.delta +
    options.effect.runtime.emissionRateOverDistance * distance;

  const spawnCount = Math.floor(options.cpu.spawnAccumulator);
  options.cpu.spawnAccumulator -= spawnCount;

  spawnParticleContinuousCount({ ...options, count: spawnCount, age: 0 });

  if (hasBursts) {
    if (loopTime < previousLoopTime) {
      spawnParticleContinuousBurstWindow({
        ...options,
        startTime: previousLoopTime,
        endTime: duration,
      });
      spawnParticleContinuousBurstWindow({
        ...options,
        startTime: 0,
        endTime: loopTime,
      });
    } else {
      spawnParticleContinuousBurstWindow({
        ...options,
        startTime: previousLoopTime,
        endTime: loopTime,
      });
    }
  }
}

function spawnParticleContinuousCount(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly count: number;
  readonly age: number;
}): void {
  let remaining = Math.max(0, Math.trunc(options.count));

  while (remaining > 0) {
    const slot = nextDeadParticleSlot(options.cpu);

    if (slot < 0) {
      return;
    }

    spawnParticleContinuousSlot({
      cpu: options.cpu,
      emitter: options.emitter,
      effect: options.effect,
      snapshot: options.snapshot,
      index: slot,
      ageT: 0,
      age: options.age,
    });
    remaining -= 1;
  }
}

function spawnParticleContinuousBurstWindow(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly startTime: number;
  readonly endTime: number;
}): void {
  if (options.endTime < options.startTime) {
    return;
  }

  for (
    let burstIndex = 0;
    burstIndex < options.effect.runtime.bursts.length;
    burstIndex += 1
  ) {
    const burst = options.effect.runtime.bursts[burstIndex];

    if (burst === undefined) {
      continue;
    }

    for (let cycleIndex = 0; cycleIndex < burst.cycle; cycleIndex += 1) {
      const burstTime = burst.time + cycleIndex * burst.interval;
      const inWindow =
        (burstTime > options.startTime && burstTime <= options.endTime) ||
        (options.startTime === 0 && burstTime === 0);

      if (!inWindow) {
        continue;
      }

      const probability = clamp01(burst.probability);
      const roll = hashUnit(
        options.emitter.seed ^
          (burstIndex * 1597334677) ^
          (cycleIndex * 3812015801) ^
          Math.trunc(burstTime * 1000),
      );

      if (roll > probability) {
        continue;
      }

      spawnParticleContinuousCount({
        cpu: options.cpu,
        emitter: options.emitter,
        effect: options.effect,
        snapshot: options.snapshot,
        count: burst.count,
        age: Math.max(0, options.endTime - burstTime),
      });
    }
  }
}

function particleEmitterTravelDistance(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly snapshot: RenderSnapshot;
}): number {
  const origin = emitterWorldOrigin(options.snapshot, options.emitter);
  let distance = 0;

  if (options.cpu.hasLastOrigin) {
    distance = Math.hypot(
      origin[0] - options.cpu.lastOriginX,
      origin[1] - options.cpu.lastOriginY,
      origin[2] - options.cpu.lastOriginZ,
    );
  }

  options.cpu.lastOriginX = origin[0];
  options.cpu.lastOriginY = origin[1];
  options.cpu.lastOriginZ = origin[2];
  options.cpu.hasLastOrigin = true;
  return Number.isFinite(distance) ? distance : 0;
}

function nextDeadParticleSlot(cpu: ParticleEmitterCpuStateResource): number {
  const capacity = cpu.ages.length;

  for (let scan = 0; scan < capacity; scan += 1) {
    const index = (cpu.spawnCursor + scan) % capacity;
    if ((cpu.ages[index] ?? 0) >= (cpu.lifetimes[index] ?? 0)) {
      cpu.spawnCursor = (index + 1) % capacity;
      return index;
    }
  }

  return -1;
}

function spawnParticleContinuousSlot(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly index: number;
  readonly ageT: number;
  readonly age?: number;
}): void {
  const serial = options.cpu.spawnSerial;
  options.cpu.spawnSerial += 1;

  const r0 = hashUnit(options.emitter.seed ^ (serial * 747796405));
  const r1 = hashUnit(options.emitter.seed ^ (serial * 277803737));
  const r2 = hashUnit(options.emitter.seed ^ (serial * 1442695041));
  const r3 = hashUnit(options.emitter.seed ^ (serial * 1597334677));
  const r4 = hashUnit(options.emitter.seed ^ (serial * 2891336453));
  const r5 = hashUnit(options.emitter.seed ^ (serial * 1013904223));
  const lifetime = Math.max(
    0.001,
    lerp(
      options.effect.runtime.lifetime.min,
      options.effect.runtime.lifetime.max,
      r3,
    ),
  );
  const initialAge =
    options.age === undefined
      ? clamp01(options.ageT) * lifetime
      : Math.min(Math.max(0, options.age), Math.max(0, lifetime - 0.0001));
  const sourceOffset = options.index * 3;
  const sample = sampleContinuousParticleShape({
    effect: options.effect,
    snapshot: options.snapshot,
    emitter: options.emitter,
    random: [r0, r1, r2, r3, r4, r5],
  });

  options.cpu.positions[sourceOffset] = sample.position[0];
  options.cpu.positions[sourceOffset + 1] = sample.position[1];
  options.cpu.positions[sourceOffset + 2] = sample.position[2];
  options.cpu.velocities[sourceOffset] =
    sample.direction[0] *
    lerp(
      options.effect.runtime.startSpeed.min,
      options.effect.runtime.startSpeed.max,
      r4,
    );
  options.cpu.velocities[sourceOffset + 1] =
    sample.direction[1] *
    lerp(
      options.effect.runtime.startSpeed.min,
      options.effect.runtime.startSpeed.max,
      r4,
    );
  options.cpu.velocities[sourceOffset + 2] =
    sample.direction[2] *
    lerp(
      options.effect.runtime.startSpeed.min,
      options.effect.runtime.startSpeed.max,
      r4,
    );
  options.cpu.lifetimes[options.index] = lifetime;
  options.cpu.ages[options.index] = initialAge;
  options.cpu.rotations[options.index] = lerp(
    options.effect.runtime.startRotation.min,
    options.effect.runtime.startRotation.max,
    r0,
  );
  options.cpu.angularVelocities[options.index] = lerp(
    options.effect.runtime.angularVelocity.min,
    options.effect.runtime.angularVelocity.max,
    r1,
  );
  if ((options.cpu.ages[options.index] ?? 0) > 0) {
    const age = options.cpu.ages[options.index] ?? 0;

    options.cpu.velocities[sourceOffset] =
      (options.cpu.velocities[sourceOffset] ?? 0) +
      options.effect.runtime.gravity[0] * age;
    options.cpu.velocities[sourceOffset + 1] =
      (options.cpu.velocities[sourceOffset + 1] ?? 0) +
      options.effect.runtime.gravity[1] * age;
    options.cpu.velocities[sourceOffset + 2] =
      (options.cpu.velocities[sourceOffset + 2] ?? 0) +
      options.effect.runtime.gravity[2] * age;
    options.cpu.positions[sourceOffset] =
      (options.cpu.positions[sourceOffset] ?? 0) +
      (options.cpu.velocities[sourceOffset] ?? 0) * age;
    options.cpu.positions[sourceOffset + 1] =
      (options.cpu.positions[sourceOffset + 1] ?? 0) +
      (options.cpu.velocities[sourceOffset + 1] ?? 0) * age;
    options.cpu.positions[sourceOffset + 2] =
      (options.cpu.positions[sourceOffset + 2] ?? 0) +
      (options.cpu.velocities[sourceOffset + 2] ?? 0) * age;
  }
  options.cpu.baseSizes[options.index] = Math.max(
    0.001,
    lerp(
      options.effect.runtime.startSize.min,
      options.effect.runtime.startSize.max,
      r5,
    ),
  );
  options.cpu.maxLifetime = Math.max(options.cpu.maxLifetime, lifetime);
}

function sampleContinuousParticleShape(options: {
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly emitter: ParticleEmitterPacket;
  readonly random: readonly [number, number, number, number, number, number];
}): {
  readonly position: readonly [number, number, number];
  readonly direction: readonly [number, number, number];
} {
  const origin = emitterWorldOrigin(options.snapshot, options.emitter);
  const shape = options.effect.shape;
  const unit = randomUnitVector(
    options.random[0],
    options.random[1],
    shape.type === "hemisphere",
  );
  const radius = Math.max(0, shape.radius);
  const shellMin = radius * (1 - clamp01(shape.radiusThickness));
  const shellRadius = lerp(shellMin, radius, options.random[2]);

  if (!shape.enabled || shape.type === "point") {
    return { position: origin, direction: unit };
  }

  if (shape.type === "sphere" || shape.type === "hemisphere") {
    return {
      position: [
        origin[0] + unit[0] * shellRadius,
        origin[1] + unit[1] * shellRadius,
        origin[2] + unit[2] * shellRadius,
      ],
      direction: unit,
    };
  }

  if (shape.type === "circle") {
    const angle = options.random[0] * Math.PI * 2;
    const circleRadius = Math.sqrt(options.random[1]) * radius;
    const direction = normalize3([Math.cos(angle), Math.sin(angle), 0]);

    return {
      position: [
        origin[0] + direction[0] * circleRadius,
        origin[1] + direction[1] * circleRadius,
        origin[2],
      ],
      direction,
    };
  }

  if (shape.type === "donut") {
    const angle = options.random[0] * Math.PI * 2;
    const innerRadius = radius * (1 - clamp01(shape.radiusThickness));
    const donutRadius = lerp(innerRadius, radius, Math.sqrt(options.random[1]));
    const direction = normalize3([Math.cos(angle), Math.sin(angle), 0]);

    return {
      position: [
        origin[0] + direction[0] * donutRadius,
        origin[1] + direction[1] * donutRadius,
        origin[2],
      ],
      direction,
    };
  }

  if (shape.type === "rectangle") {
    const box = shape.box;
    const width = Math.max(0, box[0] ?? 0);
    const height = Math.max(0, box[1] ?? 0);

    return {
      position: [
        origin[0] + (options.random[0] - 0.5) * width,
        origin[1] + (options.random[1] - 0.5) * height,
        origin[2],
      ],
      direction: unit,
    };
  }

  if (shape.type === "grid") {
    const box = shape.box;
    const scale = shape.scale;
    const columns = Math.max(1, Math.trunc(Math.abs(scale[0] ?? 1)));
    const rows = Math.max(1, Math.trunc(Math.abs(scale[1] ?? 1)));
    const layers = Math.max(1, Math.trunc(Math.abs(scale[2] ?? 1)));
    const column = Math.min(
      columns - 1,
      Math.floor(options.random[0] * columns),
    );
    const row = Math.min(rows - 1, Math.floor(options.random[1] * rows));
    const layer = Math.min(layers - 1, Math.floor(options.random[2] * layers));

    return {
      position: [
        origin[0] + gridCoordinate(column, columns, Math.max(0, box[0] ?? 0)),
        origin[1] + gridCoordinate(row, rows, Math.max(0, box[1] ?? 0)),
        origin[2] + gridCoordinate(layer, layers, Math.max(0, box[2] ?? 0)),
      ],
      direction: unit,
    };
  }

  if (shape.type === "mesh-surface") {
    const box = shape.box;
    const fallbackExtent = Math.max(1, radius * 2);
    const extents: readonly [number, number, number] = [
      Math.max(0, box[0] ?? 0) || fallbackExtent,
      Math.max(0, box[1] ?? 0) || fallbackExtent,
      Math.max(0, box[2] ?? 0) || fallbackExtent,
    ];
    const face = Math.min(5, Math.floor(options.random[0] * 6));
    const u = options.random[1] - 0.5;
    const v = options.random[2] - 0.5;
    const halfX = extents[0] * 0.5;
    const halfY = extents[1] * 0.5;
    const halfZ = extents[2] * 0.5;

    switch (face) {
      case 0:
        return {
          position: [
            origin[0] + halfX,
            origin[1] + u * extents[1],
            origin[2] + v * extents[2],
          ],
          direction: [1, 0, 0],
        };
      case 1:
        return {
          position: [
            origin[0] - halfX,
            origin[1] + u * extents[1],
            origin[2] + v * extents[2],
          ],
          direction: [-1, 0, 0],
        };
      case 2:
        return {
          position: [
            origin[0] + u * extents[0],
            origin[1] + halfY,
            origin[2] + v * extents[2],
          ],
          direction: [0, 1, 0],
        };
      case 3:
        return {
          position: [
            origin[0] + u * extents[0],
            origin[1] - halfY,
            origin[2] + v * extents[2],
          ],
          direction: [0, -1, 0],
        };
      case 4:
        return {
          position: [
            origin[0] + u * extents[0],
            origin[1] + v * extents[1],
            origin[2] + halfZ,
          ],
          direction: [0, 0, 1],
        };
      default:
        return {
          position: [
            origin[0] + u * extents[0],
            origin[1] + v * extents[1],
            origin[2] - halfZ,
          ],
          direction: [0, 0, -1],
        };
    }
  }

  if (shape.type === "cone") {
    const angle = options.random[0] * Math.PI * 2;
    const coneRadius = Math.sqrt(options.random[1]) * radius;
    const spread = Math.tan((Math.max(0, shape.angle) * Math.PI) / 180);
    const direction = normalize3([
      Math.cos(angle) * spread,
      Math.sin(angle) * spread,
      1,
    ]);

    return {
      position: [
        origin[0] + Math.cos(angle) * coneRadius,
        origin[1] + Math.sin(angle) * coneRadius,
        origin[2],
      ],
      direction,
    };
  }

  if (shape.type === "box") {
    const box = shape.box;

    return {
      position: [
        origin[0] + (options.random[0] - 0.5) * Math.max(0, box[0] ?? 0),
        origin[1] + (options.random[1] - 0.5) * Math.max(0, box[1] ?? 0),
        origin[2] + (options.random[2] - 0.5) * Math.max(0, box[2] ?? 0),
      ],
      direction: unit,
    };
  }

  return { position: origin, direction: unit };
}

function randomUnitVector(
  azimuthRandom: number,
  zRandom: number,
  hemisphere: boolean,
): readonly [number, number, number] {
  const azimuth = azimuthRandom * Math.PI * 2;
  const z = hemisphere ? zRandom : zRandom * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));

  return [Math.cos(azimuth) * r, Math.sin(azimuth) * r, z];
}

function normalize3(
  value: readonly [number, number, number],
): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (!Number.isFinite(length) || length <= 0.000001) {
    return [0, 0, 1];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function gridCoordinate(index: number, count: number, extent: number): number {
  if (count <= 1 || extent <= 0) {
    return 0;
  }

  return (index / (count - 1) - 0.5) * extent;
}

function ensureParticleBurstCpuInitialized(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly time: number;
}): void {
  if (options.cpu.initialized) {
    return;
  }

  initializeParticleBurstCpuState({
    cpu: options.cpu,
    emitter: options.emitter,
    effect: options.effect,
  });
  options.cpu.initialized = true;
  options.cpu.startTime = options.emitter.burst?.startTime ?? options.time;
  options.cpu.lastTime = options.cpu.startTime;
}

function initializeParticleBurstCpuState(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
}): void {
  const burst = options.emitter.burst;
  if (burst === undefined) {
    return;
  }

  let maxLifetime = 0;
  const uniformLifetime =
    options.effect.runtime.lifetime.min === options.effect.runtime.lifetime.max;

  for (let index = 0; index < options.emitter.capacity; index += 1) {
    const offset = index * 3;
    const r0 = hashUnit(options.emitter.seed ^ (index * 747796405));
    const r1 = hashUnit(options.emitter.seed ^ (index * 277803737));
    const r2 = hashUnit(options.emitter.seed ^ (index * 1442695041));
    const r3 = hashUnit(options.emitter.seed ^ (index * 1597334677));
    const r4 = hashUnit(options.emitter.seed ^ (index * 2891336453));

    options.cpu.positions[offset] =
      burst.position[0] +
      lerp(burst.positionJitterMin[0], burst.positionJitterMax[0], r0);
    options.cpu.positions[offset + 1] =
      burst.position[1] +
      lerp(burst.positionJitterMin[1], burst.positionJitterMax[1], r1);
    options.cpu.positions[offset + 2] =
      burst.position[2] +
      lerp(burst.positionJitterMin[2], burst.positionJitterMax[2], r2);
    options.cpu.velocities[offset] =
      lerp(burst.velocityMin[0], burst.velocityMax[0], r2) +
      options.effect.runtime.velocityOverLifetime[0];
    options.cpu.velocities[offset + 1] =
      lerp(burst.velocityMin[1], burst.velocityMax[1], r3) +
      options.effect.runtime.velocityOverLifetime[1];
    options.cpu.velocities[offset + 2] =
      lerp(burst.velocityMin[2], burst.velocityMax[2], r4) +
      options.effect.runtime.velocityOverLifetime[2];
    options.cpu.ages[index] = 0;
    const lifetime = Math.max(
      0.001,
      lerp(
        options.effect.runtime.lifetime.min,
        options.effect.runtime.lifetime.max,
        r3,
      ),
    );
    options.cpu.lifetimes[index] = lifetime;
    maxLifetime = Math.max(maxLifetime, lifetime);
    options.cpu.baseSizes[index] = Math.max(
      0.001,
      lerp(
        options.effect.runtime.startSize.min,
        options.effect.runtime.startSize.max,
        r4,
      ),
    );
    options.cpu.rotations[index] = lerp(
      options.effect.runtime.startRotation.min,
      options.effect.runtime.startRotation.max,
      r0,
    );
    options.cpu.angularVelocities[index] = lerp(
      options.effect.runtime.angularVelocity.min,
      options.effect.runtime.angularVelocity.max,
      r1,
    );
  }

  options.cpu.maxLifetime = maxLifetime;
  options.cpu.uniformLifetime = uniformLifetime;
}

function writeParticleCpuBuffer(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly effect: ParticleEmitterEffectAsset;
  readonly delta: number;
  readonly origin: readonly [number, number, number];
  readonly applyContinuousModules: boolean;
}): number {
  let live = 0;
  const dampingFactor =
    options.effect.runtime.linearDamping <= 0
      ? 1
      : Math.exp(-options.effect.runtime.linearDamping * options.delta);

  for (let index = 0; index < options.cpu.ages.length; index += 1) {
    const lifetime = options.cpu.lifetimes[index] ?? 0;
    let age = (options.cpu.ages[index] ?? 0) + options.delta;

    if (age >= lifetime) {
      options.cpu.ages[index] = lifetime;
      continue;
    }

    options.cpu.ages[index] = age;
    let lifeT = clamp01(age / lifetime);
    const sourceOffset = index * 3;
    options.cpu.velocities[sourceOffset] =
      (options.cpu.velocities[sourceOffset] ?? 0) +
      options.effect.runtime.gravity[0] * options.delta;
    options.cpu.velocities[sourceOffset + 1] =
      (options.cpu.velocities[sourceOffset + 1] ?? 0) +
      options.effect.runtime.gravity[1] * options.delta;
    options.cpu.velocities[sourceOffset + 2] =
      (options.cpu.velocities[sourceOffset + 2] ?? 0) +
      options.effect.runtime.gravity[2] * options.delta;
    options.cpu.velocities[sourceOffset] =
      (options.cpu.velocities[sourceOffset] ?? 0) * dampingFactor;
    options.cpu.velocities[sourceOffset + 1] =
      (options.cpu.velocities[sourceOffset + 1] ?? 0) * dampingFactor;
    options.cpu.velocities[sourceOffset + 2] =
      (options.cpu.velocities[sourceOffset + 2] ?? 0) * dampingFactor;
    const speedFactor = sampleRuntimeScalarCurve(
      options.effect.runtime.speedOverLifetime,
      lifeT,
    );
    let motionX =
      (options.cpu.velocities[sourceOffset] ?? 0) * speedFactor +
      options.effect.runtime.velocityOverLifetime[0];
    let motionY =
      (options.cpu.velocities[sourceOffset + 1] ?? 0) * speedFactor +
      options.effect.runtime.velocityOverLifetime[1];
    let motionZ =
      (options.cpu.velocities[sourceOffset + 2] ?? 0) * speedFactor +
      options.effect.runtime.velocityOverLifetime[2];
    if (options.applyContinuousModules) {
      const moduleMotion = continuousParticleMotionModules({
        effect: options.effect,
        position: [
          options.cpu.positions[sourceOffset] ?? 0,
          options.cpu.positions[sourceOffset + 1] ?? 0,
          options.cpu.positions[sourceOffset + 2] ?? 0,
        ],
        origin: options.origin,
        index,
        age,
        lifeT,
      });

      motionX += moduleMotion[0];
      motionY += moduleMotion[1];
      motionZ += moduleMotion[2];
    }
    const unclampedSpeed = Math.hypot(motionX, motionY, motionZ);

    if (
      options.effect.runtime.maxSpeed > 0 &&
      unclampedSpeed > options.effect.runtime.maxSpeed
    ) {
      const clampScale = options.effect.runtime.maxSpeed / unclampedSpeed;

      motionX *= clampScale;
      motionY *= clampScale;
      motionZ *= clampScale;
    }

    const nextX =
      (options.cpu.positions[sourceOffset] ?? 0) + motionX * options.delta;
    let nextY =
      (options.cpu.positions[sourceOffset + 1] ?? 0) + motionY * options.delta;
    const nextZ =
      (options.cpu.positions[sourceOffset + 2] ?? 0) + motionZ * options.delta;

    if (
      options.applyContinuousModules &&
      options.effect.runtime.collisionEnabled
    ) {
      const planeY = options.origin[1];

      if (nextY < planeY) {
        const dampenScale = Math.max(
          0,
          1 - clamp01(options.effect.runtime.collisionDampen),
        );
        const bounce = Math.max(0, options.effect.runtime.collisionBounce);

        nextY = planeY;
        motionX *= dampenScale;
        motionZ *= dampenScale;

        if (motionY < 0) {
          motionY = -motionY * bounce * dampenScale;
        }

        options.cpu.velocities[sourceOffset] =
          (options.cpu.velocities[sourceOffset] ?? 0) * dampenScale;
        options.cpu.velocities[sourceOffset + 1] =
          motionY - options.effect.runtime.velocityOverLifetime[1];
        options.cpu.velocities[sourceOffset + 2] =
          (options.cpu.velocities[sourceOffset + 2] ?? 0) * dampenScale;

        if (options.effect.runtime.collisionLifetimeLoss > 0) {
          age = Math.min(
            lifetime,
            age + options.effect.runtime.collisionLifetimeLoss * lifetime,
          );
          options.cpu.ages[index] = age;
          lifeT = clamp01(age / lifetime);

          if (age >= lifetime) {
            continue;
          }
        }
      }
    }

    const motionSpeed = Math.hypot(motionX, motionY, motionZ);
    const speedT = normalizedRangeT(
      motionSpeed,
      options.effect.runtime.sizeBySpeedRange,
    );
    const colorSpeedT = normalizedRangeT(
      motionSpeed,
      options.effect.runtime.colorBySpeedRange,
    );
    const rotationSpeedT = normalizedRangeT(
      motionSpeed,
      options.effect.runtime.rotationBySpeedRange,
    );
    options.cpu.positions[sourceOffset] = nextX;
    options.cpu.positions[sourceOffset + 1] = nextY;
    options.cpu.positions[sourceOffset + 2] = nextZ;

    const baseColor = samplePackedParticleColorCurve(options.effect, lifeT);
    const speedColor = sampleRuntimeColorGradient(
      options.effect.runtime.colorBySpeed,
      colorSpeedT,
    );
    const sizeBySpeed = sampleRuntimeScalarCurve(
      options.effect.runtime.sizeBySpeed,
      speedT,
    );
    const speedAngularVelocity = lerp(
      options.effect.runtime.angularVelocityBySpeed.min,
      options.effect.runtime.angularVelocityBySpeed.max,
      rotationSpeedT,
    );
    const outputOffset = live * PARTICLE_DATA_FLOAT_STRIDE;
    const particleSize = Math.max(
      0.001,
      (options.cpu.baseSizes[index] ?? 1) *
        samplePackedParticleSizeCurve(options.effect, lifeT) *
        sizeBySpeed,
    );
    const trailLength =
      options.effect.trails.enabled === true
        ? motionSpeed *
          Math.max(0, options.effect.runtime.trailLifetime) *
          Math.max(0, options.effect.runtime.trailRatio)
        : motionSpeed;
    const renderMotionLength =
      options.effect.runtime.renderMode === "trail" ||
      options.effect.trails.enabled === true
        ? Math.max(options.effect.runtime.trailMinVertexDistance, trailLength)
        : motionSpeed;

    options.cpu.bufferData[outputOffset] =
      options.cpu.positions[sourceOffset] ?? 0;
    options.cpu.bufferData[outputOffset + 1] =
      options.cpu.positions[sourceOffset + 1] ?? 0;
    options.cpu.bufferData[outputOffset + 2] =
      options.cpu.positions[sourceOffset + 2] ?? 0;
    options.cpu.bufferData[outputOffset + 3] = particleSize;
    options.cpu.bufferData[outputOffset + 4] = baseColor[0] * speedColor[0];
    options.cpu.bufferData[outputOffset + 5] = baseColor[1] * speedColor[1];
    options.cpu.bufferData[outputOffset + 6] = baseColor[2] * speedColor[2];
    options.cpu.bufferData[outputOffset + 7] = baseColor[3] * speedColor[3];
    writeParticleFrameData(options.cpu.bufferData, outputOffset + 8, {
      effect: options.effect,
      lifeT,
      rotation:
        (options.cpu.rotations[index] ?? 0) +
        ((options.cpu.angularVelocities[index] ?? 0) + speedAngularVelocity) *
          age,
    });
    options.cpu.bufferData[outputOffset + 12] = motionX;
    options.cpu.bufferData[outputOffset + 13] = motionY;
    options.cpu.bufferData[outputOffset + 14] = motionZ;
    options.cpu.bufferData[outputOffset + 15] = renderMotionLength;
    live += 1;
  }

  options.cpu.liveCount = live;
  return live;
}

function continuousParticleMotionModules(options: {
  readonly effect: ParticleEmitterEffectAsset;
  readonly position: readonly [number, number, number];
  readonly origin: readonly [number, number, number];
  readonly index: number;
  readonly age: number;
  readonly lifeT: number;
}): readonly [number, number, number] {
  let motionX = 0;
  let motionY = 0;
  let motionZ = 0;
  const runtime = options.effect.runtime;

  if (
    runtime.orbitalVelocity[0] !== 0 ||
    runtime.orbitalVelocity[1] !== 0 ||
    runtime.orbitalVelocity[2] !== 0 ||
    runtime.radialVelocity !== 0
  ) {
    const relative: readonly [number, number, number] = [
      options.position[0] - options.origin[0] - runtime.orbitalOffset[0],
      options.position[1] - options.origin[1] - runtime.orbitalOffset[1],
      options.position[2] - options.origin[2] - runtime.orbitalOffset[2],
    ];
    const radial = normalizeOrZero3(relative);
    const orbital = cross3(runtime.orbitalVelocity, relative);

    motionX += orbital[0] + radial[0] * runtime.radialVelocity;
    motionY += orbital[1] + radial[1] * runtime.radialVelocity;
    motionZ += orbital[2] + radial[2] * runtime.radialVelocity;
  }

  if (runtime.noiseStrength > 0 && runtime.noiseFrequency > 0) {
    const damping = runtime.noiseDamping ? 1 - options.lifeT : 1;
    const strength = runtime.noiseStrength * damping;
    const phase = options.age * runtime.noiseScrollSpeed;
    const noise = particleNoiseVector({
      index: options.index,
      position: options.position,
      frequency: runtime.noiseFrequency,
      phase,
    });

    motionX += noise[0] * strength;
    motionY += noise[1] * strength;
    motionZ += noise[2] * strength;
  }

  return [motionX, motionY, motionZ];
}

function particleNoiseVector(options: {
  readonly index: number;
  readonly position: readonly [number, number, number];
  readonly frequency: number;
  readonly phase: number;
}): readonly [number, number, number] {
  const seed = options.index * 19.19 + options.phase;
  const x = options.position[0] * options.frequency;
  const y = options.position[1] * options.frequency;
  const z = options.position[2] * options.frequency;

  return normalizeOrZero3([
    signedNoise(x + y * 1.37 + z * 2.11 + seed),
    signedNoise(x * 2.23 - y + z * 1.71 + seed + 17.17),
    signedNoise(-x * 1.83 + y * 2.57 + z + seed + 31.31),
  ]);
}

function signedNoise(value: number): number {
  const raw = Math.sin(value * 12.9898 + Math.sin(value * 78.233) * 37.719);
  return (raw - Math.floor(raw)) * 2 - 1;
}

function cross3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalizeOrZero3(
  value: readonly [number, number, number],
): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (!Number.isFinite(length) || length <= 0.000001) {
    return [0, 0, 0];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function hashUnit(value: number): number {
  let x = value >>> 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
  x = ((x >>> 16) ^ x) >>> 0;
  return (x & 0x00ff_ffff) / 0x0100_0000;
}

function writeParticleBurstRenderCurveData(
  floats: Float32Array,
  effect: ParticleEmitterEffectAsset,
): void {
  for (let index = 0; index < PARTICLE_CURVE_SAMPLE_COUNT; index += 1) {
    const t = index / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
    const color = samplePackedParticleColorCurve(effect, t);

    floats[PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET + index] =
      samplePackedParticleSizeCurve(effect, t);
    floats[PARTICLE_BURST_FRAME_CURVE_FLOAT_OFFSET + index] =
      sampleRuntimeScalarCurve(effect.runtime.textureSheetFrameOverTime, t);
    floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4] = color[0];
    floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 1] = color[1];
    floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 2] = color[2];
    floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 3] = color[3];
  }
}

function writeParticleFrameData(
  floats: Float32Array,
  offset: number,
  options: {
    readonly effect: ParticleEmitterEffectAsset;
    readonly lifeT: number;
    readonly rotation: number;
  },
): void {
  floats[offset] = options.effect.runtime.textureSheetTiles[0];
  floats[offset + 1] = options.effect.runtime.textureSheetTiles[1];
  floats[offset + 2] = particleAtlasFrameIndex(options.effect, options.lifeT);
  floats[offset + 3] = options.rotation;
}

function particleAtlasFrameIndex(
  effect: ParticleEmitterEffectAsset,
  lifeT: number,
): number {
  const frameCount = Math.max(1, Math.trunc(effect.runtime.atlasFrameCount));

  if (frameCount <= 1) {
    return 0;
  }

  const frameT = sampleRuntimeScalarCurve(
    effect.runtime.textureSheetFrameOverTime,
    lifeT,
  );
  const rawFrame =
    effect.runtime.textureSheetStartFrame +
    frameT * frameCount * effect.runtime.textureSheetCycleCount;

  return Math.floor(positiveModulo(rawFrame, frameCount));
}

function samplePackedParticleSizeCurve(
  effect: ParticleEmitterEffectAsset,
  t: number,
): number {
  return samplePackedScalarTable(effect.curves.sizeOverLifetime, t);
}

function samplePackedParticleColorCurve(
  effect: ParticleEmitterEffectAsset,
  t: number,
): readonly [number, number, number, number] {
  const color = effect.curves.colorOverLifetime;
  const sampleCount = effect.curves.sampleCount;

  if (sampleCount <= 1) {
    return [
      color[0] ?? effect.runtime.startColor[0],
      color[1] ?? effect.runtime.startColor[1],
      color[2] ?? effect.runtime.startColor[2],
      color[3] ?? effect.runtime.startColor[3],
    ];
  }

  const scaled = clamp01(t) * (sampleCount - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(sampleCount - 1, lower + 1);
  const blend = scaled - lower;
  const lowerOffset = lower * 4;
  const upperOffset = upper * 4;

  return [
    lerp(
      color[lowerOffset] ?? effect.runtime.startColor[0],
      color[upperOffset] ?? effect.runtime.endColor[0],
      blend,
    ),
    lerp(
      color[lowerOffset + 1] ?? effect.runtime.startColor[1],
      color[upperOffset + 1] ?? effect.runtime.endColor[1],
      blend,
    ),
    lerp(
      color[lowerOffset + 2] ?? effect.runtime.startColor[2],
      color[upperOffset + 2] ?? effect.runtime.endColor[2],
      blend,
    ),
    lerp(
      color[lowerOffset + 3] ?? effect.runtime.startColor[3],
      color[upperOffset + 3] ?? effect.runtime.endColor[3],
      blend,
    ),
  ];
}

function samplePackedScalarTable(values: Float32Array, t: number): number {
  if (values.length <= 1) {
    return values[0] ?? 1;
  }

  const scaled = clamp01(t) * (values.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(values.length - 1, lower + 1);

  return lerp(values[lower] ?? 1, values[upper] ?? 1, scaled - lower);
}

function sampleRuntimeScalarCurve(
  curve: readonly { readonly t: number; readonly value: number }[],
  t: number,
): number {
  if (curve.length <= 0) {
    return 0;
  }
  if (curve.length === 1) {
    return curve[0]?.value ?? 0;
  }

  const life = clamp01(t);
  let previous = curve[0] ?? { t: 0, value: 0 };

  if (life <= previous.t) {
    return previous.value;
  }

  for (let index = 1; index < curve.length; index += 1) {
    const next = curve[index];

    if (next === undefined) {
      continue;
    }
    if (life > next.t) {
      previous = next;
      continue;
    }

    const width = Math.max(0.0001, next.t - previous.t);
    return lerp(previous.value, next.value, (life - previous.t) / width);
  }

  return previous.value;
}

function sampleRuntimeColorGradient(
  gradient: readonly ParticleGradientKeyframe[],
  t: number,
): readonly [number, number, number, number] {
  if (gradient.length <= 0) {
    return [1, 1, 1, 1];
  }
  if (gradient.length === 1) {
    return tuple4(gradient[0]?.color ?? [1, 1, 1, 1]);
  }

  const life = clamp01(t);
  let previous = gradient[0] ?? { t: 0, color: [1, 1, 1, 1] };

  if (life <= previous.t) {
    return tuple4(previous.color);
  }

  for (let index = 1; index < gradient.length; index += 1) {
    const next = gradient[index];

    if (next === undefined) {
      continue;
    }
    if (life > next.t) {
      previous = next;
      continue;
    }

    const width = Math.max(0.0001, next.t - previous.t);
    const blend = (life - previous.t) / width;
    const previousColor = tuple4(previous.color);
    const nextColor = tuple4(next.color);

    return [
      lerp(previousColor[0], nextColor[0], blend),
      lerp(previousColor[1], nextColor[1], blend),
      lerp(previousColor[2], nextColor[2], blend),
      lerp(previousColor[3], nextColor[3], blend),
    ];
  }

  return tuple4(previous.color);
}

function tuple4(
  value: ArrayLike<number> | undefined,
): readonly [number, number, number, number] {
  return [value?.[0] ?? 1, value?.[1] ?? 1, value?.[2] ?? 1, value?.[3] ?? 1];
}

function normalizedRangeT(value: number, range: ParticleScalarRange): number {
  const min = range.min;
  const max = range.max;

  if (
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return 0;
  }
  if (max <= min) {
    return value >= max ? 1 : 0;
  }

  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finiteOrZero(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value) ? 0 : value;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function viewUniformData(options: {
  readonly app: WebGpuAppParticleContext;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
}): Float32Array {
  const source = options.viewUniforms.data.subarray(
    0,
    options.viewUniforms.floatCount ?? options.viewUniforms.data.length,
  );
  const data = new Float32Array(source);
  const dimensions =
    options.app.canvas === undefined
      ? { width: 1, height: 1 }
      : webGpuAppCanvasDimensions(options.app.canvas);

  for (const record of options.viewUniforms.views) {
    const view = options.snapshot.views.find(
      (candidate) => candidate.viewId === record.viewId,
    );
    const viewport = view?.viewport ?? [0, 0, 1, 1];
    const offset = record.packedOffset + PARTICLE_VIEWPORT_FLOAT_OFFSET;

    if (offset + 3 >= data.length) {
      continue;
    }

    const width = Math.max(1, dimensions.width * (viewport[2] ?? 1));
    const height = Math.max(1, dimensions.height * (viewport[3] ?? 1));

    data[offset] = width;
    data[offset + 1] = height;
    data[offset + 2] = 1 / width;
    data[offset + 3] = 1 / height;
  }

  return data;
}

function particleEmitterStateKey(emitter: ParticleEmitterPacket): string {
  return `particle:${emitter.emitterId}:effect-v${emitter.effectVersion}:capacity-${emitter.capacity}:reset-${emitter.resetEpoch}`;
}

function emitterWorldOrigin(
  snapshot: RenderSnapshot,
  emitter: ParticleEmitterPacket,
): readonly [number, number, number] {
  const offset = emitter.worldTransformOffset;

  return [
    snapshot.transforms[offset + 12] ?? 0,
    snapshot.transforms[offset + 13] ?? 0,
    snapshot.transforms[offset + 14] ?? 0,
  ];
}

function cleanupParticleStates(
  cache: WebGpuAppResourceCache,
  activeKeys: Set<string>,
): number {
  let removed = 0;

  for (const key of cache.particleEmitterStates.keys()) {
    if (!activeKeys.has(key)) {
      destroyWebGpuBuffer(cache.particleEmitterStates.get(key)?.particleBuffer);
      cache.particleEmitterStates.delete(key);
      removed += 1;
    }
  }

  return removed;
}

function cleanupParticleBurstCpuStates(
  cache: WebGpuAppResourceCache,
  activeKeys: Set<string>,
): number {
  let removed = 0;

  for (const key of cache.particleBurstCpuStates.keys()) {
    if (!activeKeys.has(key)) {
      cache.particleBurstCpuStates.delete(key);
      removed += 1;
    }
  }

  return removed;
}

function cleanupParticleBurstBatchStates(
  cache: WebGpuAppResourceCache,
  activeKeys: Set<string>,
): number {
  let removed = 0;

  for (const key of cache.particleBurstBatchStates.keys()) {
    if (!activeKeys.has(key)) {
      const state = cache.particleBurstBatchStates.get(key);

      destroyWebGpuBuffer(state?.particleBuffer);
      destroyWebGpuBuffer(state?.paramBuffer);
      cache.particleBurstBatchStates.delete(key);
      removed += 1;
    }
  }

  return removed;
}

function nextPowerOfTwo(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1;
  }

  return 2 ** Math.ceil(Math.log2(value));
}

export function emptyParticleFrameReport(emitters = 0): ParticleFrameReport {
  return {
    emitters,
    liveParticles: 0,
    texturedEmitters: 0,
    statesCreated: 0,
    statesReused: 0,
    staleStatesRemoved: 0,
    dispatches: 0,
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
  };
}

function createParticleTextureSamplerReuseReport(): AppTextureSamplerResourceReuseReport {
  return {
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
  };
}

function particleTextureSamplerReuseSnapshot(
  reuse: AppTextureSamplerResourceReuseReport,
): AppTextureSamplerResourceReuseReport {
  return {
    textureResourcesCreated: reuse.textureResourcesCreated,
    textureResourcesReused: reuse.textureResourcesReused,
    samplerResourcesCreated: reuse.samplerResourcesCreated,
    samplerResourcesReused: reuse.samplerResourcesReused,
  };
}

type MutableParticleFrameReport = {
  -readonly [Key in keyof ParticleFrameReport]: ParticleFrameReport[Key];
};
