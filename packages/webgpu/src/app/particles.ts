import {
  assetHandleKey,
  createParticleEffectHandle,
  type AssetRegistry,
  type MaybePromise,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type PackedSnapshotViewUniforms,
  type ParticleColorValue,
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
  ParticleSubEmissionTracker,
  ParticleSoftParamsResource,
  ParticleViewUniformBufferResource,
  WebGpuAppResourceCache,
} from "./resource-cache.js";
import {
  webGpuAppScenePassColorFormat,
  webGpuAppUsesHdrScenePass,
} from "./render-color-format.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";

const PARTICLE_FIXED_RANDOM_SEED = -0x8000_0000;

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
  /** Emitters whose CPU particle state was advanced this frame. */
  readonly simulatedEmitters: number;
  readonly liveParticles: number;
  readonly texturedEmitters: number;
  /** Shared particle draw groups prepared this frame. */
  readonly batchGroups: number;
  /** Emitters represented by shared particle draw groups. */
  readonly batchedEmitters: number;
  /** Particle draw commands emitted after batching. */
  readonly drawCalls: number;
  /** CPU particle bytes uploaded to GPU storage buffers this frame. */
  readonly uploadedBytes: number;
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
// Wire format: 12-float base record + appended startColor*colorTint vec4
// (floats 12-15) + appended burst emitter-origin vec4 (floats 16-19). New
// fields are always appended, never inserted, so the existing offsets stay
// stable across format extensions.
const PARTICLE_BURST_DATA_FLOAT_STRIDE = 20;
// Float 19 was the reserved spare in the emitter-origin vec4. It now carries
// the particle's block index in the batch's params array, which is what lets
// one draw cover several effects.
const PARTICLE_BURST_PARAM_INDEX_FLOAT_OFFSET = 19;
const PARTICLE_CURVE_SAMPLE_COUNT = 16;
const PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT =
  4 +
  4 +
  4 +
  4 * 4 +
  4 * 4 +
  4 * 4 +
  16 * 4 +
  // Appended burst modulation-module data: speed curve + its two integral
  // tables, size-by-speed curve, color-by-speed gradient, and five packed
  // module parameter vec4s.
  4 * 4 +
  4 * 4 +
  4 * 4 +
  4 * 4 +
  16 * 4 +
  4 * 5;
const PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET = 8;
const PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET = 12;
const PARTICLE_BURST_FRAME_CURVE_MIN_FLOAT_OFFSET =
  PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_FRAME_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_FRAME_CURVE_MIN_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_FRAME_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_SPEED_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT * 4;
const PARTICLE_BURST_SPEED_CURVE_INTEGRAL_FLOAT_OFFSET =
  PARTICLE_BURST_SPEED_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_SPEED_CURVE_TIME_INTEGRAL_FLOAT_OFFSET =
  PARTICLE_BURST_SPEED_CURVE_INTEGRAL_FLOAT_OFFSET +
  PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_SIZE_BY_SPEED_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_SPEED_CURVE_TIME_INTEGRAL_FLOAT_OFFSET +
  PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_COLOR_BY_SPEED_CURVE_FLOAT_OFFSET =
  PARTICLE_BURST_SIZE_BY_SPEED_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_BURST_MODULE_PARAM_FLOAT_OFFSET =
  PARTICLE_BURST_COLOR_BY_SPEED_CURVE_FLOAT_OFFSET +
  PARTICLE_CURVE_SAMPLE_COUNT * 4;
const PARTICLE_DEFAULT_TEXTURE_CACHE_KEY = "particle:default-white-texture";
const PARTICLE_DEFAULT_SAMPLER_CACHE_KEY = "particle:default-linear-sampler";
const PARTICLE_SPHERE_VERTEX_COUNT = 16 * 8 * 6;

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
  readonly groupKey: string;
  readonly key: string;
  readonly records: PreparedParticleEmitterRecord[];
}

interface ParticleContinuousBatchUnit {
  readonly kind: "continuousBatch";
  readonly groupKey: string;
  readonly key: string;
  readonly records: PreparedParticleEmitterRecord[];
}

type ParticleFrameUnit =
  | ParticleBurstBatchUnit
  | ParticleContinuousBatchUnit
  | {
      readonly kind: "single";
      readonly record: PreparedParticleEmitterRecord;
    }
  | {
      readonly kind: "subEmitter";
      readonly parent: PreparedParticleEmitterRecord;
      readonly record: PreparedParticleEmitterRecord;
      readonly subEmitterIndex: number;
      readonly trigger: "birth" | "death";
      readonly probability: number;
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
    retireStaleParticleBuffers(
      options.app.initialization.device,
      options.cache,
    );
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
  renderStage: ParticleEmitterEffectAsset["renderer"]["renderStage"] = "scene",
  toneMapped = true,
  outputColorSpaceOverride: OutputColorSpace = "srgb",
): MaybePromise<CreateParticleRenderPipelineResourceResult> {
  const presentationPipeline = renderStage === "post-tonemap" || softParticles;
  const authoredPresentationPipeline = renderStage === "post-tonemap";
  const colorFormat = presentationPipeline
    ? app.initialization.format
    : webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = presentationPipeline
    ? authoredPresentationPipeline
      ? toneMapped
        ? (app.tonemap ?? "none")
        : "none"
      : (app.tonemap ?? "none")
    : isHdr
      ? "none"
      : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = presentationPipeline
    ? authoredPresentationPipeline
      ? outputColorSpaceOverride
      : (app.outputColorSpace ?? "linear")
    : isHdr
      ? "linear"
      : (app.outputColorSpace ?? "linear");
  const sampleCount = presentationPipeline ? 1 : app.msaa.sampleCount;
  const depthFormat =
    presentationPipeline && app.msaa.sampleCount > 1
      ? null
      : WEBGPU_APP_DEPTH_FORMAT;
  const key = particleRenderPipelineCacheKey(
    colorFormat,
    depthFormat,
    sampleCount,
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
    depthFormat,
    sampleCount,
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
  renderStage: ParticleEmitterEffectAsset["renderer"]["renderStage"] = "scene",
  toneMapped = true,
  outputColorSpaceOverride: OutputColorSpace = "srgb",
): MaybePromise<CreateParticleRenderPipelineResourceResult> {
  const presentationPipeline = renderStage === "post-tonemap" || softParticles;
  const authoredPresentationPipeline = renderStage === "post-tonemap";
  const colorFormat = presentationPipeline
    ? app.initialization.format
    : webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = presentationPipeline
    ? authoredPresentationPipeline
      ? toneMapped
        ? (app.tonemap ?? "none")
        : "none"
      : (app.tonemap ?? "none")
    : isHdr
      ? "none"
      : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = presentationPipeline
    ? authoredPresentationPipeline
      ? outputColorSpaceOverride
      : (app.outputColorSpace ?? "linear")
    : isHdr
      ? "linear"
      : (app.outputColorSpace ?? "linear");
  const sampleCount = presentationPipeline ? 1 : app.msaa.sampleCount;
  const depthFormat =
    presentationPipeline && app.msaa.sampleCount > 1
      ? null
      : WEBGPU_APP_DEPTH_FORMAT;
  const key = particleBurstRenderPipelineCacheKey(
    colorFormat,
    depthFormat,
    sampleCount,
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
    depthFormat,
    sampleCount,
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
    case "sphere":
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
  const burstBatchSegmentCounts = new Map<string, number>();
  const additiveBurstBatchGroups = new Map<string, ParticleBurstBatchUnit>();
  const continuousBatchGroups = new Map<string, ParticleContinuousBatchUnit>();

  for (const emitter of options.snapshot.particleEmitters ?? []) {
    // Burst parents with birth/death subemitters leave the shared GPU-analytic
    // batch and take the per-emitter CPU burst path, where per-slot births and
    // deaths are observable deterministically without GPU readback.
    const burstBatchable =
      isBatchableParticleBurst(emitter) &&
      !particleEffectHasSpawnableSubEmitters(options.assets, emitter);
    const preparedResult = prepareParticleEmitterFrameResources({
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
    const prepared = isPromiseLike(preparedResult)
      ? await preparedResult
      : preparedResult;

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
      const groupKey = particleBurstBatchUnitKey(record);

      // Additive compositing is order independent, so compatible additive
      // bursts can share one GPU batch even when other additive effects are
      // interleaved between them. Keep the map scoped to the current run of
      // additive bursts: crossing a continuous or alpha-blended emitter could
      // change compositing order.
      if (prepared.effect.runtime.blendMode === "additive") {
        activeBurstGroup = null;
        const existing = additiveBurstBatchGroups.get(groupKey);
        if (existing !== undefined) {
          existing.records.push(record);
        } else {
          const group: ParticleBurstBatchUnit = {
            kind: "burstBatch",
            groupKey,
            key: `${groupKey}|additive`,
            records: [record],
          };
          additiveBurstBatchGroups.set(groupKey, group);
          units.push(group);
        }
        continue;
      }

      additiveBurstBatchGroups.clear();
      if (activeBurstGroup !== null && activeBurstGroup.groupKey === groupKey) {
        activeBurstGroup.records.push(record);
      } else {
        const segment: number = burstBatchSegmentCounts.get(groupKey) ?? 0;
        burstBatchSegmentCounts.set(groupKey, segment + 1);
        activeBurstGroup = {
          kind: "burstBatch",
          groupKey,
          key: `${groupKey}|segment:${segment}`,
          records: [record],
        };
        units.push(activeBurstGroup);
      }
      continue;
    }

    additiveBurstBatchGroups.clear();
    activeBurstGroup = null;
    if (
      record.emitter.mode !== "burst" &&
      prepared.effect.subEmitters.length === 0
    ) {
      const groupKey = particleContinuousBatchUnitKey(record);
      const existing = continuousBatchGroups.get(groupKey);
      if (existing !== undefined) {
        existing.records.push(record);
      } else {
        const group: ParticleContinuousBatchUnit = {
          kind: "continuousBatch",
          groupKey,
          key: `continuous|${groupKey}`,
          records: [record],
        };
        continuousBatchGroups.set(groupKey, group);
        units.push(group);
      }
      continue;
    }

    units.push({ kind: "single", record });

    for (
      let subEmitterIndex = 0;
      subEmitterIndex < prepared.effect.subEmitters.length;
      subEmitterIndex += 1
    ) {
      const subEmitter = prepared.effect.subEmitters[subEmitterIndex];
      if (
        subEmitter === undefined ||
        (subEmitter.type !== "birth" && subEmitter.type !== "death")
      ) {
        diagnostics.push({
          code: "particleFrame.subEmitterModeUnsupported",
          message:
            "Only birth and death subemitters are implemented for particle emitters.",
        });
        continue;
      }

      const childHandle = createParticleEffectHandle(subEmitter.effect);
      const childEntry = options.assets.get<
        "particle-effect",
        ParticleEffectAsset
      >(childHandle);
      const childEffect = childEntry?.asset;
      if (
        childEntry?.status !== "ready" ||
        childEffect === undefined ||
        childEffect === null ||
        childEffect.type !== "emitter"
      ) {
        diagnostics.push({
          code: "particleFrame.subEmitterEffectNotReady",
          message: `Particle subemitter effect '${assetHandleKey(childHandle)}' is not ready as a leaf emitter.`,
        });
        continue;
      }

      const childEmitterId = particleSubEmitterId(
        emitter.emitterId,
        subEmitterIndex,
        subEmitter.effect,
      );
      const childEmitter: ParticleEmitterPacket = {
        emitterId: childEmitterId,
        entity: emitter.entity,
        effect: childHandle,
        effectVersion: childEntry.version,
        capacity: Math.max(
          childEffect.runtime.capacity,
          Math.ceil(
            emitter.capacity *
              childEffect.runtime.capacity *
              (childEffect.runtime.emissionRateOverDistance > 0
                ? Math.max(1, prepared.effect.runtime.startSpeed.max)
                : 1),
          ),
        ),
        seed: isParticleFixedRandomSeed(emitter.seed)
          ? PARTICLE_FIXED_RANDOM_SEED
          : (emitter.seed ^
              ((subEmitterIndex + 1) * 2246822519) ^
              childEmitterId) >>>
            0,
        resetEpoch: emitter.resetEpoch,
        ...(emitter.lifecycleStartTime === undefined
          ? {}
          : { lifecycleStartTime: emitter.lifecycleStartTime }),
        timeScale: emitter.timeScale,
        simulationSpace: "world",
        worldTransformOffset: emitter.worldTransformOffset,
        boundsIndex: emitter.boundsIndex,
        layerMask: emitter.layerMask,
        sortKey: {
          ...emitter.sortKey,
          order: childEffect.renderer.renderOrder,
          stableId: childEmitterId,
          materialKey: assetHandleKey(childHandle),
        },
        mode: "continuous",
      };
      const childPreparedResult = prepareParticleEmitterFrameResources({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        device,
        snapshot: options.snapshot,
        emitter: childEmitter,
        burstBatchable: false,
        reuse,
        diagnostics,
        renderPipelineFrameCache,
        textureSamplerFrameCache,
        emitterResourceFrameCache,
      });
      const childPrepared = isPromiseLike(childPreparedResult)
        ? await childPreparedResult
        : childPreparedResult;
      if (childPrepared === null) {
        continue;
      }

      const childRecord: PreparedParticleEmitterRecord = {
        emitter: childEmitter,
        effectKey: childPrepared.effectKey,
        effect: childPrepared.effect,
        renderPipeline: childPrepared.renderPipeline,
        renderPipelineResource: childPrepared.renderPipelineResource,
        textureSampler: childPrepared.textureSampler,
        softResources: childPrepared.softResources,
      };
      units.push({
        kind: "subEmitter",
        parent: record,
        record: childRecord,
        subEmitterIndex,
        trigger: subEmitter.type,
        probability: clamp01(subEmitter.probability ?? 1),
      });
      mutableReport.emitters += 1;
      if (
        childPrepared.effect.runtime.texture !== undefined &&
        childPrepared.effect.runtime.texture !== null
      ) {
        mutableReport.texturedEmitters += 1;
      }
    }
  }

  // A singleton gets no draw-call benefit from the shared path and keeping it
  // on the ordinary emitter state avoids an extra batch buffer allocation.
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (unit?.kind === "continuousBatch" && unit.records.length === 1) {
      units[index] = { kind: "single", record: unit.records[0]! };
    }
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
        commands: particleRecordUsesOverlay(unit.records[0])
          ? overlayCommands
          : commands,
      });

      diagnostics.push(...batchReport.diagnostics);
      mutableReport.simulatedEmitters += batchReport.simulatedEmitters;
      mutableReport.batchGroups += 1;
      mutableReport.batchedEmitters += unit.records.length;
      mutableReport.liveParticles += batchReport.liveParticles;
      mutableReport.drawCalls += batchReport.liveParticles > 0 ? 1 : 0;
      mutableReport.uploadedBytes += batchReport.uploadedBytes;
      mutableReport.statesCreated += batchReport.statesCreated;
      mutableReport.statesReused += batchReport.statesReused;
      continue;
    }

    if (unit.kind === "continuousBatch") {
      const batchReport = writeParticleContinuousBatchCommands({
        cache: options.cache,
        device,
        snapshot: options.snapshot,
        viewBuffer: viewBuffer.resource.buffer,
        frame: options.snapshot.frame,
        time: options.time,
        unit,
        activeCpuStateKeys: activeBurstCpuStateKeys,
        activeBatchKeys: activeBurstBatchKeys,
        commands: particleRecordUsesOverlay(unit.records[0])
          ? overlayCommands
          : commands,
      });

      diagnostics.push(...batchReport.diagnostics);
      mutableReport.simulatedEmitters += batchReport.simulatedEmitters;
      mutableReport.batchGroups += 1;
      mutableReport.batchedEmitters += unit.records.length;
      mutableReport.liveParticles += batchReport.liveParticles;
      mutableReport.drawCalls += batchReport.liveParticles > 0 ? 1 : 0;
      mutableReport.uploadedBytes += batchReport.uploadedBytes;
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
    let reusedFrozenPack = false;

    if (unit.kind === "subEmitter") {
      const parentState = options.cache.particleEmitterStates.get(
        particleEmitterStateKey(unit.parent.emitter),
      );
      if (
        parentState?.cpu === undefined ||
        stateResult.state.cpu === undefined
      ) {
        diagnostics.push({
          code: "particleFrame.subEmitterParentStateMissing",
          message:
            "Subemitter simulation requires live CPU state for both parent and child emitters.",
        });
        continue;
      }
      const subEmitterReport = updateParticleSubEmitterCpuState({
        parentCpu: parentState.cpu,
        childCpu: stateResult.state.cpu,
        parentEmitter: unit.parent.emitter,
        childEmitter: record.emitter,
        childEffect: record.effect,
        snapshot: options.snapshot,
        subEmitterIndex: unit.subEmitterIndex,
        trigger: unit.trigger,
        probability: unit.probability,
        time: options.time,
      });
      diagnostics.push(...subEmitterReport.diagnostics);
      drawInstanceCount = subEmitterReport.liveParticles;
      if (drawInstanceCount > 0 && device.queue?.writeBuffer !== undefined) {
        device.queue.writeBuffer(
          stateResult.state.particleBuffer,
          0,
          stateResult.state.cpu.bufferData.buffer,
          stateResult.state.cpu.bufferData.byteOffset,
          drawInstanceCount * PARTICLE_DATA_FLOAT_STRIDE * 4,
        );
      }
    } else if (
      record.emitter.mode === "burst" &&
      record.emitter.burst !== undefined
    ) {
      const burstReport = updateParticleBurstCpuState({
        device,
        state: stateResult.state,
        emitter: record.emitter,
        effect: record.effect,
        snapshot: options.snapshot,
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
      reusedFrozenPack = continuousReport.reusedFrozenPack;
    }

    mutableReport.simulatedEmitters += reusedFrozenPack ? 0 : 1;

    if (drawInstanceCount <= 0) {
      continue;
    }
    mutableReport.drawCalls += 1;
    mutableReport.uploadedBytes += reusedFrozenPack
      ? 0
      : drawInstanceCount *
        PARTICLE_DATA_FLOAT_STRIDE *
        Float32Array.BYTES_PER_ELEMENT;

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
    const targetCommands = particleRecordUsesOverlay(record)
      ? overlayCommands
      : commands;
    const pipelineCommandKey = particlePipelineCommandKey(record);

    targetCommands.push(
      {
        kind: "setPipeline",
        renderId: record.emitter.emitterId,
        pipelineKey: pipelineCommandKey,
        pipeline: record.renderPipelineResource.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: record.emitter.emitterId,
        index: 0,
        resourceKey: "particle:view",
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
        vertexCount: particleVertexCount(record.effect),
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
  retireStaleParticleBuffers(device, options.cache);

  return {
    valid: diagnostics.length === 0,
    commands,
    overlayCommands,
    diagnostics,
    report,
  };
}

/**
 * Resolve one emitter's pipeline, texture, sampler, and soft-particle
 * resources.
 *
 * Returns synchronously whenever nothing has to be compiled — which, after the
 * first frame that used an effect, is every emitter. Only render-pipeline
 * creation can be asynchronous, so the promise is returned instead of awaited
 * and the per-frame loop pays one microtask per compiled pipeline rather than
 * one per emitter per frame.
 */
function prepareParticleEmitterFrameResources(options: {
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
}): MaybePromise<PreparedParticleEmitterFrameResources | null> {
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
  const renderPipelineFrameKey = `${effect.runtime.blendMode}:${renderPipelineMode}:${options.burstBatchable ? "burst" : "computed"}:${softParticles ? "soft" : "hard"}:${effect.renderer.renderStage}:${effect.renderer.toneMapped ? "tonemapped" : "raw"}:${effect.renderer.outputColorSpace}`;
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
          effect.renderer.renderStage,
          effect.renderer.toneMapped,
          effect.renderer.outputColorSpace,
        )
      : getOrCreateWebGpuAppParticleRenderPipeline(
          options.app,
          options.cache,
          effect.runtime.blendMode,
          effect.runtime.renderMode,
          softParticles,
          effect.renderer.renderStage,
          effect.renderer.toneMapped,
          effect.renderer.outputColorSpace,
        );

    if (isPromiseLike(pipelineResult)) {
      return pipelineResult.then((resolved) => {
        options.renderPipelineFrameCache.set(renderPipelineFrameKey, resolved);
        return finishParticleEmitterFrameResources({
          ...options,
          cacheKey,
          effectKey,
          effect,
          softResources,
          renderPipelineResult: resolved,
        });
      });
    }

    renderPipelineResult = pipelineResult;
    options.renderPipelineFrameCache.set(
      renderPipelineFrameKey,
      renderPipelineResult,
    );
  }

  return finishParticleEmitterFrameResources({
    ...options,
    cacheKey,
    effectKey,
    effect,
    softResources,
    renderPipelineResult,
  });
}

function finishParticleEmitterFrameResources(options: {
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: unknown[];
  readonly textureSamplerFrameCache: Map<string, ParticleTextureSampler>;
  readonly emitterResourceFrameCache: Map<
    string,
    PreparedParticleEmitterFrameResources | null
  >;
  readonly cacheKey: string;
  readonly effectKey: string;
  readonly effect: ParticleEmitterEffectAsset;
  readonly softResources: ParticleSoftResources | null;
  readonly renderPipelineResult: CreateParticleRenderPipelineResourceResult;
}): PreparedParticleEmitterFrameResources | null {
  const { cacheKey, effect, effectKey, renderPipelineResult } = options;

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
    softResources: options.softResources,
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

function getOrCreateParticleBatchBindGroups(options: {
  readonly device: {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  };
  readonly state: ParticleBurstBatchGpuStateResource;
  readonly record: PreparedParticleEmitterRecord;
  readonly viewBuffer: unknown;
  readonly paramsBuffer?: unknown;
  readonly softGroupIndex: number;
}): {
  readonly view: unknown;
  readonly particle: unknown;
  readonly texture: unknown;
  readonly params: unknown | null;
  readonly soft: unknown | null;
} {
  const { device, state, record } = options;
  const createBindGroup = device.createBindGroup;
  if (createBindGroup === undefined) {
    throw new Error("Particle batch bind groups require createBindGroup.");
  }
  const create = (descriptor: unknown): unknown =>
    createBindGroup.call(device, descriptor);
  const textureView = record.textureSampler.texture.view;
  const textureSampler = record.textureSampler.sampler.sampler;

  if (
    state.viewBindGroup === null ||
    state.viewBindGroupBuffer !== options.viewBuffer
  ) {
    state.viewBindGroup = create({
      label: `Particle/BatchViewBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: options.viewBuffer } }],
    });
    state.viewBindGroupBuffer = options.viewBuffer;
  }

  if (state.particleBindGroup === null) {
    state.particleBindGroup = create({
      label: `Particle/BatchRenderBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: state.particleBuffer } }],
    });
  }

  if (
    state.textureBindGroup === null ||
    state.textureBindGroupView !== textureView ||
    state.textureBindGroupSampler !== textureSampler
  ) {
    state.textureBindGroup = create({
      label: `Particle/BatchTextureBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: textureView },
        { binding: 1, resource: textureSampler },
      ],
    });
    state.textureBindGroupView = textureView;
    state.textureBindGroupSampler = textureSampler;
  }

  const paramsGroupIndex = 3;
  if (
    options.paramsBuffer !== undefined &&
    (state.paramBindGroup === null ||
      state.paramBindGroupBuffer !== options.paramsBuffer)
  ) {
    state.paramBindGroup = create({
      label: `Particle/BatchParamsBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(paramsGroupIndex),
      entries: [{ binding: 0, resource: { buffer: options.paramsBuffer } }],
    });
    state.paramBindGroupBuffer = options.paramsBuffer;
  }

  const softResources = record.softResources;
  if (
    softResources !== null &&
    (state.softBindGroup === null ||
      state.softBindGroupDepthView !== softResources.depthView ||
      state.softBindGroupParamsBuffer !== softResources.paramsBuffer)
  ) {
    state.softBindGroup = create({
      label: `Particle/BatchSoftBindGroup/${record.emitter.emitterId}`,
      layout: record.renderPipeline.getBindGroupLayout(options.softGroupIndex),
      entries: [
        { binding: 0, resource: softResources.depthView },
        { binding: 1, resource: { buffer: softResources.paramsBuffer } },
      ],
    });
    state.softBindGroupDepthView = softResources.depthView;
    state.softBindGroupParamsBuffer = softResources.paramsBuffer;
  }

  return {
    view: state.viewBindGroup,
    particle: state.particleBindGroup,
    texture: state.textureBindGroup,
    params: options.paramsBuffer === undefined ? null : state.paramBindGroup,
    soft: softResources === null ? null : state.softBindGroup,
  };
}

function particleRecordUsesOverlay(
  record: PreparedParticleEmitterRecord | undefined,
): boolean {
  return (
    record !== undefined &&
    (record.softResources !== null ||
      record.effect.renderer.renderStage === "post-tonemap")
  );
}

function particlePipelineCommandKey(
  record: PreparedParticleEmitterRecord,
): string {
  return record.effect.renderer.renderStage === "post-tonemap"
    ? `${record.renderPipelineResource.cacheKey}:particle-overlay`
    : record.renderPipelineResource.cacheKey;
}

function isBatchableParticleBurst(emitter: ParticleEmitterPacket): boolean {
  return (
    emitter.mode === "burst" &&
    emitter.burst !== undefined &&
    emitter.simulationSpace === "world" &&
    emitter.capacity > 0
  );
}

/**
 * Whether the emitter's ready effect declares subemitters the CPU frame
 * simulation implements (birth or death triggers). Collision subemitters do
 * not force an emitter off the batched path because nothing consumes them yet.
 */
function particleEffectHasSpawnableSubEmitters(
  assets: AssetRegistry,
  emitter: ParticleEmitterPacket,
): boolean {
  const entry = assets.get<"particle-effect", ParticleEffectAsset>(
    emitter.effect,
  );
  const effect = entry?.asset;

  return (
    entry?.status === "ready" &&
    effect !== undefined &&
    effect !== null &&
    effect.type === "emitter" &&
    effect.subEmitters.some(
      (subEmitter) =>
        subEmitter.type === "birth" || subEmitter.type === "death",
    )
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

/**
 * Batch compatibility for GPU-analytic bursts: everything the shared draw
 * actually fixes, and nothing else.
 *
 * The render pipeline cache key already encodes the color/depth formats,
 * sample count, blend mode, render mode, soft-particle variant and output
 * stage, so it stands in for "same pipeline + same blend mode". Adding the
 * texture/sampler pair (one bind group), the render stage (which command list
 * the draw lands in), the soft resources (one bind group) and the sort
 * placement (which decides draw ORDER between groups) completes the set.
 *
 * The effect asset is deliberately NOT part of the key. Its immutable scalar
 * and curve state moved into the batch's params array, indexed per particle,
 * so bursts of different effects that agree on the above render in one draw.
 */
function particleBurstBatchUnitKey(
  record: PreparedParticleEmitterRecord,
): string {
  const { emitter, textureSampler } = record;

  return [
    "particle-burst-batch",
    `pipeline:${record.renderPipelineResource.cacheKey}`,
    `stage:${record.effect.renderer.renderStage}`,
    `texture:${textureSampler.textureKey}`,
    `sampler:${textureSampler.samplerKey}`,
    `soft:${record.softResources?.resourceKey ?? "none"}`,
    `view:${emitter.sortKey.viewId}`,
    `layer-mask:${emitter.layerMask}`,
    `sort-layer:${emitter.sortKey.layer}`,
    `order:${emitter.sortKey.order}`,
  ].join("|");
}

/**
 * Batch compatibility for the CPU-simulated continuous path.
 *
 * That path carries no per-effect GPU state — every authored value is baked
 * into the per-particle record before upload — but its slices are
 * concatenated in unit order and drawn as one contiguous range, so merging
 * across effects would reorder alpha compositing between them. Keep the
 * effect in the key: this is the pre-existing grouping, unchanged.
 */
function particleContinuousBatchUnitKey(
  record: PreparedParticleEmitterRecord,
): string {
  return [
    `effect:${record.effectKey}@${record.emitter.effectVersion}`,
    particleBurstBatchUnitKey(record),
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
  readonly simulatedEmitters: number;
  readonly uploadedBytes: number;
  readonly statesCreated: number;
  readonly statesReused: number;
  readonly diagnostics: readonly unknown[];
} {
  const first = options.unit.records[0];

  if (first === undefined) {
    return {
      liveParticles: 0,
      simulatedEmitters: 0,
      uploadedBytes: 0,
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
      simulatedEmitters: 0,
      uploadedBytes: 0,
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
    readonly paramIndex: number;
  }[] = [];
  // One params block per distinct effect in the batch, in first-live order.
  const paramEffects: ParticleEmitterEffectAsset[] = [];
  const paramIndexByEffectKey = new Map<string, number>();
  let totalCapacity = 0;
  let totalLiveParticles = 0;
  let statesCreated = 0;
  let statesReused = 0;
  const hasStablePlaybackClock = options.unit.records.every(
    (record) =>
      Number.isFinite(record.emitter.playbackTime) ||
      record.emitter.timeScale === 0,
  );

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

    const effectParamKey = `${record.effectKey}@${record.emitter.effectVersion}`;
    let paramIndex = paramIndexByEffectKey.get(effectParamKey);

    if (paramIndex === undefined) {
      paramIndex = paramEffects.length;
      paramIndexByEffectKey.set(effectParamKey, paramIndex);
      paramEffects.push(record.effect);
    }

    totalLiveParticles += update.liveParticles;
    liveSlices.push({
      key: slotKey,
      cpu: cpuState.cpu,
      emitter: record.emitter,
      effect: record.effect,
      liveParticles: update.liveParticles,
      capacity,
      paramIndex,
    });
  }

  if (totalLiveParticles <= 0) {
    return {
      liveParticles: 0,
      simulatedEmitters: 0,
      uploadedBytes: 0,
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
      simulatedEmitters: 0,
      uploadedBytes: 0,
      statesCreated,
      statesReused,
      diagnostics: [...diagnostics, ...batchState.diagnostics],
    };
  }

  options.activeBurstBatchKeys.add(batchState.state.key);
  statesCreated += batchState.created ? 1 : 0;
  statesReused += batchState.created ? 0 : 1;

  const frozenLayoutKey = hasStablePlaybackClock
    ? particleFrozenBurstBatchLayoutKey(liveSlices)
    : null;
  const reuseFrozenLayout =
    frozenLayoutKey !== null &&
    batchState.state.frozenLayoutKey === frozenLayoutKey;
  if (!reuseFrozenLayout) {
    resetParticleBurstBatchSlots(batchState.state);
  }

  const activeDrawRanges: {
    readonly firstInstance: number;
    readonly instanceCount: number;
  }[] = [];
  const uploadRanges: { byteOffset: number; byteLength: number }[] = [];
  for (const slice of liveSlices) {
    const slot = reuseFrozenLayout
      ? batchState.state.slotsByBurstKey.get(slice.key) === undefined
        ? null
        : {
            slot: batchState.state.slotsByBurstKey.get(slice.key)!,
            created: false,
          }
      : acquireParticleBurstBatchSlot(
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

    if (!reuseFrozenLayout) {
      const upload = writeParticleBurstInitialSlotData({
        state: batchState.state,
        slot: slot.slot,
        cpu: slice.cpu,
        emitter: slice.emitter,
        paramIndex: slice.paramIndex,
      });
      uploadRanges.push(upload);
    }

    activeDrawRanges.push({
      firstInstance: slot.slot.offset,
      instanceCount: slot.slot.capacity,
    });
  }

  const drawRanges = particleBurstDrawEnvelope(activeDrawRanges);

  if (drawRanges.length === 0) {
    return {
      liveParticles: totalLiveParticles,
      simulatedEmitters: reuseFrozenLayout ? 0 : options.unit.records.length,
      uploadedBytes: 0,
      statesCreated,
      statesReused,
      diagnostics,
    };
  }

  let uploadedBytes = 0;
  for (const upload of mergeParticleBurstUploadRanges(uploadRanges)) {
    options.device.queue.writeBuffer(
      batchState.state.particleBuffer,
      upload.byteOffset,
      batchState.state.bufferData.buffer,
      batchState.state.bufferData.byteOffset + upload.byteOffset,
      upload.byteLength,
    );
    uploadedBytes += upload.byteLength;
  }

  if (hasStablePlaybackClock) {
    if (!reuseFrozenLayout) {
      batchState.state.frozenRenderTime = options.time;
      batchState.state.frozenLayoutKey = frozenLayoutKey;
    }
  } else {
    batchState.state.frozenRenderTime = null;
    batchState.state.frozenLayoutKey = null;
  }
  const renderTime = hasStablePlaybackClock
    ? (batchState.state.frozenRenderTime ?? options.time)
    : options.time;
  const params = getOrUpdateParticleBurstRenderParams({
    cache: options.cache,
    device: options.device,
    state: batchState.state,
    effects: paramEffects,
    signature: [...paramIndexByEffectKey.keys()].join("|"),
    time: renderTime,
  });

  if (!params.valid) {
    return {
      liveParticles: 0,
      simulatedEmitters: reuseFrozenLayout ? 0 : options.unit.records.length,
      uploadedBytes,
      statesCreated,
      statesReused,
      diagnostics: [...diagnostics, ...params.diagnostics],
    };
  }

  if (params.buffer === null) {
    return {
      liveParticles: 0,
      simulatedEmitters: reuseFrozenLayout ? 0 : options.unit.records.length,
      uploadedBytes,
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

  const bindGroups = getOrCreateParticleBatchBindGroups({
    device: options.device,
    state: batchState.state,
    record: first,
    viewBuffer: options.viewBuffer,
    paramsBuffer: params.buffer,
    softGroupIndex: 4,
  });
  const softResources = first.softResources;

  options.commands.push(
    {
      kind: "setPipeline",
      renderId: first.emitter.emitterId,
      pipelineKey: particlePipelineCommandKey(first),
      pipeline: first.renderPipelineResource.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 0,
      resourceKey: "particle:view",
      bindGroup: bindGroups.view,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 1,
      resourceKey: batchState.state.key,
      bindGroup: bindGroups.particle,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 2,
      resourceKey: `${first.textureSampler.textureKey}:${first.textureSampler.samplerKey}`,
      bindGroup: bindGroups.texture,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 3,
      resourceKey: `${batchState.state.key}:params`,
      bindGroup: bindGroups.params,
    },
    ...(softResources === null || bindGroups.soft === null
      ? []
      : [
          {
            kind: "setBindGroup" as const,
            renderId: first.emitter.emitterId,
            index: 4,
            resourceKey: softResources.resourceKey,
            bindGroup: bindGroups.soft,
          },
        ]),
  );

  for (const range of drawRanges) {
    options.commands.push({
      kind: "draw",
      renderId: first.emitter.emitterId,
      vertexCount: particleVertexCount(first.effect),
      instanceCount: range.instanceCount,
      firstVertex: 0,
      firstInstance: range.firstInstance,
    });
  }

  return {
    liveParticles: totalLiveParticles,
    simulatedEmitters: reuseFrozenLayout ? 0 : options.unit.records.length,
    uploadedBytes,
    statesCreated,
    statesReused,
    diagnostics,
  };
}

function writeParticleContinuousBatchCommands(options: {
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
  readonly snapshot: RenderSnapshot;
  readonly viewBuffer: unknown;
  readonly frame: number;
  readonly time: number;
  readonly unit: ParticleContinuousBatchUnit;
  readonly activeCpuStateKeys: Set<string>;
  readonly activeBatchKeys: Set<string>;
  readonly commands: RenderPassCommand[];
}): {
  readonly liveParticles: number;
  /** Members whose CPU particle state was actually advanced this frame. */
  readonly simulatedEmitters: number;
  readonly uploadedBytes: number;
  readonly statesCreated: number;
  readonly statesReused: number;
  readonly diagnostics: readonly unknown[];
} {
  const first = options.unit.records[0];
  if (
    first === undefined ||
    options.device.createBindGroup === undefined ||
    options.device.queue?.writeBuffer === undefined
  ) {
    return {
      liveParticles: 0,
      simulatedEmitters: 0,
      uploadedBytes: 0,
      statesCreated: 0,
      statesReused: 0,
      diagnostics: [
        {
          code: "particleFrame.continuousBatchUnavailable",
          message:
            "Particle continuous batching requires bind groups and queue.writeBuffer.",
        },
      ],
    };
  }

  const diagnostics: unknown[] = [];
  const liveSlices: {
    readonly cpu: ParticleEmitterCpuStateResource;
    readonly emitterId: number;
    readonly liveParticles: number;
  }[] = [];
  let totalCapacity = 0;
  let totalLiveParticles = 0;
  let statesCreated = 0;
  let statesReused = 0;
  let simulatedEmitters = 0;

  for (const record of options.unit.records) {
    totalCapacity += Math.max(0, Math.trunc(record.emitter.capacity));
    const cpuState = getOrCreateParticleBurstCpuState({
      cache: options.cache,
      emitter: record.emitter,
    });
    options.activeCpuStateKeys.add(cpuState.key);
    statesCreated += cpuState.created ? 1 : 0;
    statesReused += cpuState.created ? 0 : 1;

    const update = updateParticleContinuousCpuData({
      cpu: cpuState.cpu,
      emitter: record.emitter,
      effect: record.effect,
      snapshot: options.snapshot,
      time: options.time,
    });
    diagnostics.push(...update.diagnostics);
    simulatedEmitters += update.reusedFrozenPack ? 0 : 1;
    if (update.liveParticles <= 0) {
      continue;
    }
    totalLiveParticles += update.liveParticles;
    liveSlices.push({
      cpu: cpuState.cpu,
      emitterId: record.emitter.emitterId,
      liveParticles: update.liveParticles,
    });
  }

  if (totalLiveParticles <= 0) {
    return {
      liveParticles: 0,
      simulatedEmitters,
      uploadedBytes: 0,
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
      simulatedEmitters,
      uploadedBytes: 0,
      statesCreated,
      statesReused,
      diagnostics: [...diagnostics, ...batchState.diagnostics],
    };
  }
  options.activeBatchKeys.add(batchState.state.key);
  statesCreated += batchState.created ? 1 : 0;
  statesReused += batchState.created ? 0 : 1;

  // Nothing simulated and the same slices in the same order means the shared
  // buffer already holds these exact bytes: skip the concatenation and the
  // upload rather than re-writing an unchanged frozen field every frame.
  const reuseUpload =
    simulatedEmitters === 0 &&
    !batchState.created &&
    batchState.state.continuousUploadValid &&
    particleContinuousBatchLayoutMatches(batchState.state, liveSlices);
  let uploadedBytes = 0;

  if (!reuseUpload) {
    let targetFloatOffset = 0;
    for (const slice of liveSlices) {
      const floatCount = slice.liveParticles * PARTICLE_DATA_FLOAT_STRIDE;
      batchState.state.bufferData.set(
        slice.cpu.bufferData.subarray(0, floatCount),
        targetFloatOffset,
      );
      targetFloatOffset += floatCount;
    }
    uploadedBytes = totalLiveParticles * PARTICLE_DATA_FLOAT_STRIDE * 4;
    options.device.queue.writeBuffer(
      batchState.state.particleBuffer,
      0,
      batchState.state.bufferData.buffer,
      batchState.state.bufferData.byteOffset,
      uploadedBytes,
    );
    recordParticleContinuousBatchLayout(batchState.state, liveSlices);
  }

  const bindGroups = getOrCreateParticleBatchBindGroups({
    device: options.device,
    state: batchState.state,
    record: first,
    viewBuffer: options.viewBuffer,
    softGroupIndex: 3,
  });
  const softResources = first.softResources;

  options.commands.push(
    {
      kind: "setPipeline",
      renderId: first.emitter.emitterId,
      pipelineKey: particlePipelineCommandKey(first),
      pipeline: first.renderPipelineResource.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 0,
      resourceKey: "particle:view",
      bindGroup: bindGroups.view,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 1,
      resourceKey: batchState.state.key,
      bindGroup: bindGroups.particle,
    },
    {
      kind: "setBindGroup",
      renderId: first.emitter.emitterId,
      index: 2,
      resourceKey: `${first.textureSampler.textureKey}:${first.textureSampler.samplerKey}`,
      bindGroup: bindGroups.texture,
    },
    ...(softResources === null || bindGroups.soft === null
      ? []
      : [
          {
            kind: "setBindGroup" as const,
            renderId: first.emitter.emitterId,
            index: 3,
            resourceKey: softResources.resourceKey,
            bindGroup: bindGroups.soft,
          },
        ]),
    {
      kind: "draw",
      renderId: first.emitter.emitterId,
      vertexCount: particleVertexCount(first.effect),
      instanceCount: totalLiveParticles,
      firstVertex: 0,
      firstInstance: 0,
    },
  );

  return {
    liveParticles: totalLiveParticles,
    simulatedEmitters,
    uploadedBytes,
    statesCreated,
    statesReused,
    diagnostics,
  };
}

function particleContinuousBatchLayoutMatches(
  state: ParticleBurstBatchGpuStateResource,
  slices: readonly {
    readonly emitterId: number;
    readonly liveParticles: number;
  }[],
): boolean {
  if (state.continuousSliceIds.length !== slices.length) {
    return false;
  }

  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index] as (typeof slices)[number];

    if (
      state.continuousSliceIds[index] !== slice.emitterId ||
      state.continuousSliceCounts[index] !== slice.liveParticles
    ) {
      return false;
    }
  }

  return true;
}

function recordParticleContinuousBatchLayout(
  state: ParticleBurstBatchGpuStateResource,
  slices: readonly {
    readonly emitterId: number;
    readonly liveParticles: number;
  }[],
): void {
  state.continuousSliceIds.length = slices.length;
  state.continuousSliceCounts.length = slices.length;

  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index] as (typeof slices)[number];

    state.continuousSliceIds[index] = slice.emitterId;
    state.continuousSliceCounts[index] = slice.liveParticles;
  }

  state.continuousUploadValid = true;
}

function particleVertexCount(effect: ParticleEmitterEffectAsset): number {
  return effect.renderer.renderMode === "sphere"
    ? PARTICLE_SPHERE_VERTEX_COUNT
    : 6;
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
      // Match conventional sprite sampling (and three.quarks): minified
      // particle textures use their generated mip chain instead of aliasing
      // against the full-resolution base image.
      mipmapFilter: "linear",
      lodMaxClamp: 32,
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
    retireParticleBuffer(options.cache, cached.particleBuffer);
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
    frozenLayoutKey: null,
    frozenRenderTime: null,
    continuousSliceIds: [],
    continuousSliceCounts: [],
    continuousUploadValid: false,
    paramBuffer: null,
    paramByteLength: 0,
    paramData: null,
    paramSignature: null,
    viewBindGroup: null,
    viewBindGroupBuffer: null,
    particleBindGroup: null,
    textureBindGroup: null,
    textureBindGroupView: null,
    textureBindGroupSampler: null,
    paramBindGroup: null,
    paramBindGroupBuffer: null,
    softBindGroup: null,
    softBindGroupDepthView: null,
    softBindGroupParamsBuffer: null,
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
  /** Block this slot's effect occupies in the batch params array. */
  readonly paramIndex: number;
}): { readonly byteOffset: number; readonly byteLength: number } {
  const startFloat = options.slot.offset * PARTICLE_BURST_DATA_FLOAT_STRIDE;
  const particleCount = Math.min(
    options.slot.capacity,
    options.cpu.ages.length,
  );
  const burstOrigin = options.emitter.burst?.position ?? [0, 0, 0];
  const paramIndex = Math.max(0, Math.trunc(options.paramIndex));

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
    // startTime is rebased to the accumulated mutable-clock age. Apply unit
    // rate in the shader so pause does not zero visible age and slow motion
    // is not multiplied a second time.
    options.state.bufferData[outputOffset + 9] = 1;
    options.state.bufferData[outputOffset + 10] =
      options.cpu.rotations[index] ?? 0;
    options.state.bufferData[outputOffset + 11] =
      options.cpu.angularVelocities[index] ?? 0;
    // Appended at the end of the record, matching the snapshot codec: the
    // shader multiplies this over the authored colour curve.
    const colorOffset = index * 4;
    options.state.bufferData[outputOffset + 12] =
      (options.cpu.startColors[colorOffset] ?? 1) * options.cpu.colorTint[0];
    options.state.bufferData[outputOffset + 13] =
      (options.cpu.startColors[colorOffset + 1] ?? 1) *
      options.cpu.colorTint[1];
    options.state.bufferData[outputOffset + 14] =
      (options.cpu.startColors[colorOffset + 2] ?? 1) *
      options.cpu.colorTint[2];
    options.state.bufferData[outputOffset + 15] =
      (options.cpu.startColors[colorOffset + 3] ?? 1) *
      options.cpu.colorTint[3];
    // Appended: the burst's shared world origin, the pivot for the orbital
    // velocity module (mirrors the continuous path's emitter world origin).
    options.state.bufferData[outputOffset + 16] = burstOrigin[0] ?? 0;
    options.state.bufferData[outputOffset + 17] = burstOrigin[1] ?? 0;
    options.state.bufferData[outputOffset + 18] = burstOrigin[2] ?? 0;
    // Appended into the origin vec4's reserved spare: which params block the
    // shader reads for this particle's effect.
    options.state.bufferData[
      outputOffset + PARTICLE_BURST_PARAM_INDEX_FLOAT_OFFSET
    ] = paramIndex;
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

/**
 * Signature of the exact bytes a frozen batch already holds.
 *
 * Reusing the layout skips rewriting every slot, so the key must cover
 * everything a slot write would have produced — including the params-block
 * index, which is why the effect identity is pinned here even though the
 * emitter state key does not carry it.
 */
function particleFrozenBurstBatchLayoutKey(
  slices: readonly {
    readonly key: string;
    readonly cpu: ParticleEmitterCpuStateResource;
    readonly emitter: ParticleEmitterPacket;
    readonly capacity: number;
    readonly paramIndex: number;
  }[],
): string {
  return slices
    .map((slice) => {
      const position = slice.emitter.burst?.position ?? [0, 0, 0];
      return [
        slice.key,
        slice.capacity,
        slice.cpu.liveCount,
        slice.cpu.simulatedTime,
        position[0],
        position[1],
        position[2],
        slice.paramIndex,
        assetHandleKey(slice.emitter.effect),
      ].join(":");
    })
    .join("|");
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

/**
 * Pack and upload the batch's params array: one immutable block per effect
 * present in the batch, plus the shared render time in every block's first
 * float.
 *
 * The array is a read-only storage buffer rather than a uniform so a batch is
 * not capped by the uniform-binding size; the shader indexes it per particle.
 */
function getOrUpdateParticleBurstRenderParams(options: {
  readonly cache: WebGpuAppResourceCache;
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
  readonly effects: readonly ParticleEmitterEffectAsset[];
  /** Identity of the packed effect set, in slot order. */
  readonly signature: string;
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

  const blockCount = Math.max(1, options.effects.length);
  const floatCount = blockCount * PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT;
  const data =
    options.state.paramData?.length === floatCount
      ? options.state.paramData
      : new Float32Array(floatCount);
  const contentChanged =
    options.state.paramBuffer === null ||
    options.state.paramData?.length !== floatCount ||
    options.state.paramSignature !== options.signature ||
    data[0] !== options.time;

  for (let block = 0; block < blockCount; block += 1) {
    const effect = options.effects[block];

    if (effect === undefined) {
      continue;
    }

    writeParticleBurstRenderParamBlock(
      data,
      block * PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT,
      effect,
      options.time,
    );
  }

  if (
    options.state.paramBuffer !== null &&
    options.state.paramByteLength === data.byteLength
  ) {
    if (contentChanged) {
      options.device.queue.writeBuffer(
        options.state.paramBuffer,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
    }
    options.state.paramData = data;
    options.state.paramSignature = options.signature;
    return {
      valid: true,
      buffer: options.state.paramBuffer,
      diagnostics: [],
    };
  }

  // A resize replaces a buffer the previous submission may still reference,
  // so it takes the retirement queue rather than an inline destroy.
  retireParticleBuffer(options.cache, options.state.paramBuffer);

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: `Particle/BurstBatchParams/${options.state.key}`,
      size: data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
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
  options.state.paramSignature = options.signature;
  return { valid: true, buffer: buffer.buffer, diagnostics: [] };
}

/**
 * Write one effect's immutable render state into a params block.
 *
 * Float 0 of every block is the shared render time; everything after it is
 * fixed by the effect asset, which is exactly why it can be shared by all of
 * that effect's particles inside a batch.
 */
function writeParticleBurstRenderParamBlock(
  data: Float32Array,
  base: number,
  effect: ParticleEmitterEffectAsset,
  time: number,
): void {
  const stretched = effect.runtime.renderMode === "stretched-billboard";

  data[base] = time;
  data[base + 1] = effect.runtime.gravity[0];
  data[base + 2] = effect.runtime.gravity[1];
  data[base + 3] = effect.runtime.gravity[2];
  data[base + 4] = effect.runtime.linearDamping;
  data[base + 5] = effect.runtime.textureSheetFrameOverTimeRandom ? 1 : 0;
  data[base + 6] = stretched
    ? Math.max(0.001, effect.runtime.stretchedSpeedFactor)
    : 0;
  data[base + 7] = stretched ? effect.runtime.stretchedLengthFactor : 0;
  data[base + PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET] =
    effect.runtime.textureSheetTiles[0];
  data[base + PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET + 1] =
    effect.runtime.textureSheetTiles[1];
  data[base + PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET + 2] =
    effect.runtime.textureSheetStartFrame;
  data[base + PARTICLE_BURST_TEXTURE_SHEET_FLOAT_OFFSET + 3] =
    effect.runtime.textureSheetCycleCount;
  writeParticleBurstRenderCurveData(data, base, effect);
  writeParticleBurstModuleCurveData(data, base, effect);
  writeParticleBurstModuleParamData(data, base, effect);
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
    presentationAges: new Float32Array(capacity),
    presentationRenderAges: new Float32Array(capacity),
    lifetimes: new Float32Array(capacity),
    baseSizes: new Float32Array(capacity),
    startColors: new Float32Array(capacity * 4),
    frameRandoms: new Float32Array(capacity),
    spawnGenerations: new Uint32Array(capacity),
    birthSlots: new Int32Array(capacity),
    birthPositions: new Float32Array(capacity * 3),
    deathSlots: new Int32Array(capacity),
    deathGenerations: new Uint32Array(capacity),
    deathPositions: new Float32Array(capacity * 3),
    bufferData: new Float32Array(capacity * PARTICLE_DATA_FLOAT_STRIDE),
    initialized: false,
    startTime: 0,
    lastTime: 0,
    simulatedTime: 0,
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
    birthCount: 0,
    deathCount: 0,
    frozenSignature: null,
    subEmissionTrackers: [],
    subEmissionTrackerPool: [],
    colorTint: [1, 1, 1, 1],
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
  rebaseParticleBurstCpuPositions(options.cpu, options.emitter);

  const authoritativeTime = particleEmitterPlaybackSimulationTime(
    options.emitter,
    options.effect,
  );
  const rawDelta = options.time - options.cpu.lastTime;
  const delta =
    authoritativeTime === null
      ? !Number.isFinite(rawDelta) || rawDelta <= 0
        ? 0
        : Math.min(rawDelta, 1 / 15) *
          options.emitter.timeScale *
          options.effect.runtime.simulationSpeed
      : Math.max(0, authoritativeTime - options.cpu.simulatedTime);
  options.cpu.simulatedTime =
    authoritativeTime === null
      ? options.cpu.simulatedTime + delta
      : Math.max(options.cpu.simulatedTime, authoritativeTime);
  options.cpu.lastTime = options.time;
  // Rebase the absolute start time so the shader sees the accumulated
  // effect-local age even after the mutable playback rate changed or froze.
  options.cpu.startTime = options.time - options.cpu.simulatedTime;
  const scaledElapsed = options.cpu.simulatedTime;
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
}): ParticleContinuousUpdateResult {
  const cpu = options.state.cpu;

  if (cpu === undefined) {
    return {
      liveParticles: 0,
      reusedFrozenPack: false,
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
      reusedFrozenPack: false,
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

  // A reused pack wrote no new bytes into `cpu.bufferData`, so the emitter's
  // GPU buffer — written by this same path last frame — already holds them.
  if (update.liveParticles > 0 && !update.reusedFrozenPack) {
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

interface ParticleContinuousUpdateResult {
  readonly liveParticles: number;
  /**
   * True when this frame could not change the packed bytes and the previous
   * frame's pack (and its GPU upload) was reused verbatim.
   */
  readonly reusedFrozenPack: boolean;
  readonly diagnostics: readonly unknown[];
}

function updateParticleContinuousCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
}): ParticleContinuousUpdateResult {
  options.cpu.birthCount = 0;
  options.cpu.deathCount = 0;
  const wasInitialized = options.cpu.initialized;
  ensureParticleContinuousCpuInitialized(options);

  const authoritativeTime = particleEmitterPlaybackSimulationTime(
    options.emitter,
    options.effect,
  );
  const frozen = particleContinuousFrozenReuse({
    cpu: options.cpu,
    emitter: options.emitter,
    effect: options.effect,
    snapshot: options.snapshot,
    time: options.time,
    authoritativeTime,
  });

  if (frozen !== null) {
    // Keep the clock coherent so the first unfrozen frame steps by one frame,
    // not by the whole frozen span.
    options.cpu.lastTime = options.time;
    options.cpu.startTime = options.time - options.cpu.simulatedTime;
    return {
      liveParticles: frozen,
      reusedFrozenPack: true,
      diagnostics: [],
    };
  }

  if (authoritativeTime !== null) {
    return updateParticleContinuousCpuToPlaybackTime({
      ...options,
      wasInitialized,
      authoritativeTime,
    });
  }

  if (
    !wasInitialized &&
    options.emitter.lifecycleStartTime !== undefined &&
    options.time > options.cpu.lastTime &&
    options.emitter.timeScale > 0
  ) {
    return backfillParticleContinuousCpuData(options);
  }

  const rawDelta = options.time - options.cpu.lastTime;
  const timelineDelta =
    !Number.isFinite(rawDelta) || rawDelta <= 0
      ? 0
      : rawDelta *
        options.emitter.timeScale *
        options.effect.runtime.simulationSpeed;
  const delta =
    !Number.isFinite(rawDelta) || rawDelta <= 0
      ? 0
      : Math.min(rawDelta, 1 / 15) *
        options.emitter.timeScale *
        options.effect.runtime.simulationSpeed;

  // A Quarks burst authored at t=0 emits even when the timeline is born
  // frozen. Use a sub-float epsilon only for that first burst window; it is
  // too small to visibly age particles and is never repeated.
  const simulationDelta =
    !wasInitialized && timelineDelta <= 0 ? Number.EPSILON : timelineDelta;
  options.cpu.lastTime = options.time;
  options.cpu.simulatedTime += simulationDelta;
  options.cpu.startTime = options.time - options.cpu.simulatedTime;
  spawnParticleContinuousCpuData({ ...options, delta: simulationDelta });
  const localSimulation = options.emitter.simulationSpace === "local";
  const liveParticles = writeParticleCpuBuffer({
    cpu: options.cpu,
    effect: options.effect,
    delta: !wasInitialized && delta <= 0 ? Number.EPSILON : delta,
    origin: localSimulation
      ? [0, 0, 0]
      : emitterWorldOrigin(options.snapshot, options.emitter),
    worldTransform: localSimulation
      ? emitterWorldTransform(options.snapshot, options.emitter)
      : null,
    applyContinuousModules: true,
  });

  recordParticleContinuousFrozenSignature(options, liveParticles);
  return { liveParticles, reusedFrozenPack: false, diagnostics: [] };
}

/**
 * Advance a continuous emitter to an ECS-authored playback clock.
 *
 * The renderer deliberately consumes the accumulated clock rather than the
 * current rate. A held clock therefore preserves an in-progress frame across
 * pause, culling, device recovery, and offline bundle reconstruction.
 */
function updateParticleContinuousCpuToPlaybackTime(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
  readonly wasInitialized: boolean;
  readonly authoritativeTime: number;
}): ParticleContinuousUpdateResult {
  const localSimulation = options.emitter.simulationSpace === "local";
  const targetTime = Math.max(
    options.cpu.simulatedTime,
    options.authoritativeTime,
  );
  let remainingDelta = Math.max(0, targetTime - options.cpu.simulatedTime);
  let liveParticles: number;

  // Quarks emits t=0 bursts on the first update, including when the authored
  // clock starts frozen. A sub-float step triggers that birth without visibly
  // aging the particles.
  if (!options.wasInitialized && remainingDelta <= 0) {
    remainingDelta = Number.EPSILON;
  }

  do {
    const delta = Math.min(remainingDelta, 1 / 60);
    options.cpu.simulatedTime += delta;
    options.cpu.startTime = options.time - options.cpu.simulatedTime;
    spawnParticleContinuousCpuData({
      cpu: options.cpu,
      emitter: options.emitter,
      effect: options.effect,
      snapshot: options.snapshot,
      time: options.time,
      delta,
    });
    liveParticles = writeParticleCpuBuffer({
      cpu: options.cpu,
      effect: options.effect,
      delta,
      origin: localSimulation
        ? [0, 0, 0]
        : emitterWorldOrigin(options.snapshot, options.emitter),
      worldTransform: localSimulation
        ? emitterWorldTransform(options.snapshot, options.emitter)
        : null,
      applyContinuousModules: true,
    });
    remainingDelta = Math.max(0, remainingDelta - delta);
  } while (remainingDelta > 0.0000001);

  options.cpu.lastTime = options.time;
  recordParticleContinuousFrozenSignature(options, liveParticles);
  return { liveParticles, reusedFrozenPack: false, diagnostics: [] };
}

/**
 * Reconstruct an authored emitter when a fresh renderer first sees a snapshot
 * after its lifecycle began (offline bundle render, context recovery, or a
 * renderer handoff). Small fixed slices preserve burst windows and lifetime
 * modules instead of treating the whole gap as one clamped frame.
 */
function backfillParticleContinuousCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
}): ParticleContinuousUpdateResult {
  const localSimulation = options.emitter.simulationSpace === "local";
  let cursor = options.cpu.lastTime;
  let liveParticles = 0;
  let steps = 0;

  while (cursor < options.time && steps < 600) {
    const nextTime = Math.min(options.time, cursor + 1 / 60);
    const delta =
      (nextTime - cursor) *
      options.emitter.timeScale *
      options.effect.runtime.simulationSpeed;
    options.cpu.simulatedTime += delta;
    options.cpu.startTime = nextTime - options.cpu.simulatedTime;
    spawnParticleContinuousCpuData({
      ...options,
      time: nextTime,
      delta,
    });
    liveParticles = writeParticleCpuBuffer({
      cpu: options.cpu,
      effect: options.effect,
      delta,
      origin: localSimulation
        ? [0, 0, 0]
        : emitterWorldOrigin(options.snapshot, options.emitter),
      worldTransform: localSimulation
        ? emitterWorldTransform(options.snapshot, options.emitter)
        : null,
      applyContinuousModules: true,
    });
    cursor = nextTime;
    options.cpu.lastTime = nextTime;
    steps += 1;
  }

  recordParticleContinuousFrozenSignature(options, liveParticles);
  return { liveParticles, reusedFrozenPack: false, diagnostics: [] };
}

/**
 * Decide whether a continuous emitter can reuse the bytes it packed last
 * frame.
 *
 * `writeParticleCpuBuffer` derives the packed record purely from the CPU
 * particle arrays, the effect, the step delta, and the emitter's world
 * placement; `presentationAges` keeps a zero-delta repack byte-identical. So
 * when the step is exactly zero and the placement is unchanged, both the
 * repack and its GPU upload are provably redundant — the same invariant the
 * frozen burst-batch layout already relies on. Returns the packed live count
 * to reuse, or `null` when the frame must simulate.
 */
function particleContinuousFrozenReuse(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly time: number;
  readonly authoritativeTime: number | null;
}): number | null {
  const signature = options.cpu.frozenSignature;

  if (signature === null || !options.cpu.initialized) {
    return null;
  }

  if (options.authoritativeTime === null) {
    const rawDelta = options.time - options.cpu.lastTime;
    const timelineDelta =
      !Number.isFinite(rawDelta) || rawDelta <= 0
        ? 0
        : rawDelta *
          options.emitter.timeScale *
          options.effect.runtime.simulationSpeed;

    if (timelineDelta !== 0) {
      return null;
    }
  } else if (options.authoritativeTime > options.cpu.simulatedTime) {
    return null;
  }

  if (signature.simulationSpace !== options.emitter.simulationSpace) {
    return null;
  }

  const transform = emitterWorldTransform(options.snapshot, options.emitter);

  for (let index = 0; index < 16; index += 1) {
    if (signature.worldTransform[index] !== (transform[index] ?? 0)) {
      return null;
    }
  }

  return signature.liveParticles;
}

function recordParticleContinuousFrozenSignature(
  options: {
    readonly cpu: ParticleEmitterCpuStateResource;
    readonly emitter: ParticleEmitterPacket;
    readonly snapshot: RenderSnapshot;
  },
  liveParticles: number,
): void {
  const transform = emitterWorldTransform(options.snapshot, options.emitter);
  const existing = options.cpu.frozenSignature;
  const worldTransform =
    existing === null ? new Float32Array(16) : existing.worldTransform;

  for (let index = 0; index < 16; index += 1) {
    worldTransform[index] = transform[index] ?? 0;
  }

  options.cpu.frozenSignature = {
    liveParticles,
    simulationSpace: options.emitter.simulationSpace,
    worldTransform,
  };
}

function updateParticleSubEmitterCpuState(options: {
  readonly parentCpu: ParticleEmitterCpuStateResource;
  readonly childCpu: ParticleEmitterCpuStateResource;
  readonly parentEmitter: ParticleEmitterPacket;
  readonly childEmitter: ParticleEmitterPacket;
  readonly childEffect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly subEmitterIndex: number;
  readonly trigger: "birth" | "death";
  readonly probability: number;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  const cpu = options.childCpu;
  const wasInitialized = cpu.initialized;
  const authoritativeTime = particleEmitterPlaybackSimulationTime(
    options.childEmitter,
    options.childEffect,
  );
  const rawDelta = cpu.initialized ? options.time - cpu.lastTime : 0;
  const delta =
    authoritativeTime === null
      ? !Number.isFinite(rawDelta) || rawDelta <= 0
        ? 0
        : Math.min(rawDelta, 1 / 15) *
          options.childEmitter.timeScale *
          options.childEffect.runtime.simulationSpeed
      : Math.max(0, authoritativeTime - cpu.simulatedTime);
  if (!cpu.initialized) {
    cpu.initialized = true;
    cpu.startTime = options.time;
  }
  cpu.simulatedTime =
    authoritativeTime === null
      ? cpu.simulatedTime + delta
      : Math.max(cpu.simulatedTime, authoritativeTime);
  cpu.lastTime = options.time;
  cpu.birthCount = 0;
  cpu.deathCount = 0;

  const parentEventCount =
    options.trigger === "birth"
      ? options.parentCpu.birthCount
      : options.parentCpu.deathCount;

  if (wasInitialized && delta <= 0 && parentEventCount === 0) {
    return { liveParticles: cpu.liveCount, diagnostics: [] };
  }

  if (options.trigger === "birth") {
    seedParticleBirthSubEmissionTrackers(options);
  } else {
    seedParticleDeathSubEmissionTrackers(options);
  }

  for (
    let trackerIndex = 0;
    trackerIndex < cpu.subEmissionTrackers.length;
    trackerIndex += 1
  ) {
    const tracker = cpu.subEmissionTrackers[trackerIndex];
    if (tracker === undefined) {
      continue;
    }
    const parentSlot = tracker.parentSlot;
    const parentAlive =
      (options.parentCpu.spawnGenerations[parentSlot] ?? 0) ===
        tracker.parentGeneration &&
      (options.parentCpu.ages[parentSlot] ?? 0) <
        (options.parentCpu.lifetimes[parentSlot] ?? 0);
    const sourceOffset = parentSlot * 3;
    const currentPosition = parentAlive
      ? particleCpuPositionWorld(options.snapshot, options.parentEmitter, [
          options.parentCpu.positions[sourceOffset] ?? tracker.previousX,
          options.parentCpu.positions[sourceOffset + 1] ?? tracker.previousY,
          options.parentCpu.positions[sourceOffset + 2] ?? tracker.previousZ,
        ])
      : ([tracker.previousX, tracker.previousY, tracker.previousZ] as const);
    const distance = Math.hypot(
      currentPosition[0] - tracker.previousX,
      currentPosition[1] - tracker.previousY,
      currentPosition[2] - tracker.previousZ,
    );
    const previousTime = tracker.time;
    const nextTime = tracker.time + delta;
    tracker.spawnAccumulator +=
      options.childEffect.runtime.emissionRate * delta +
      options.childEffect.runtime.emissionRateOverDistance *
        (Number.isFinite(distance) ? distance : 0);

    let spawnCount = Math.floor(tracker.spawnAccumulator);
    tracker.spawnAccumulator -= spawnCount;
    const includeInitialBurst = tracker.firstUpdate;
    tracker.firstUpdate = false;
    spawnCount += particleSubEmitterBurstCount({
      effect: options.childEffect,
      emitter: options.childEmitter,
      tracker,
      startTime: previousTime,
      endTime: nextTime,
      includeInitialBurst,
    });
    spawnParticleSubEmitterCount({
      cpu,
      emitter: options.childEmitter,
      effect: options.childEffect,
      position: currentPosition,
      count: spawnCount,
      emitterT: clamp01(
        nextTime / Math.max(0.001, options.childEffect.runtime.duration),
      ),
    });

    tracker.previousX = currentPosition[0];
    tracker.previousY = currentPosition[1];
    tracker.previousZ = currentPosition[2];
    tracker.time = nextTime;

    if (tracker.time >= options.childEffect.runtime.duration) {
      cpu.subEmissionTrackers.splice(trackerIndex, 1);
      cpu.subEmissionTrackerPool.push(tracker);
      trackerIndex -= 1;
    }
  }

  const liveParticles = writeParticleCpuBuffer({
    cpu,
    effect: options.childEffect,
    delta,
    origin: [0, 0, 0],
    applyContinuousModules: true,
  });
  return { liveParticles, diagnostics: [] };
}

function seedParticleBirthSubEmissionTrackers(options: {
  readonly parentCpu: ParticleEmitterCpuStateResource;
  readonly childCpu: ParticleEmitterCpuStateResource;
  readonly parentEmitter: ParticleEmitterPacket;
  readonly snapshot: RenderSnapshot;
  readonly subEmitterIndex: number;
  readonly probability: number;
}): void {
  const cpu = options.childCpu;

  for (
    let birthIndex = 0;
    birthIndex < options.parentCpu.birthCount;
    birthIndex += 1
  ) {
    const parentSlot = options.parentCpu.birthSlots[birthIndex] ?? -1;
    if (parentSlot < 0) {
      continue;
    }
    const parentGeneration =
      options.parentCpu.spawnGenerations[parentSlot] ?? 0;
    const roll = particleRandomUnit(
      options.parentEmitter.seed,
      options.parentEmitter.seed ^
        (parentGeneration * 1597334677) ^
        ((options.subEmitterIndex + 1) * 3812015801),
    );
    if (roll > options.probability) {
      continue;
    }

    const tracker =
      cpu.subEmissionTrackerPool.pop() ?? createParticleSubEmissionTracker();
    const sourceOffset = parentSlot * 3;
    const birthPosition = particleCpuPositionWorld(
      options.snapshot,
      options.parentEmitter,
      [
        options.parentCpu.birthPositions[sourceOffset] ?? 0,
        options.parentCpu.birthPositions[sourceOffset + 1] ?? 0,
        options.parentCpu.birthPositions[sourceOffset + 2] ?? 0,
      ],
    );
    tracker.parentSlot = parentSlot;
    tracker.parentGeneration = parentGeneration;
    tracker.time = 0;
    tracker.spawnAccumulator = 0;
    tracker.previousX = birthPosition[0];
    tracker.previousY = birthPosition[1];
    tracker.previousZ = birthPosition[2];
    tracker.firstUpdate = true;
    cpu.subEmissionTrackers.push(tracker);
  }
}

/**
 * Seed child emission trackers from the parent's per-frame death event log.
 * A death tracker starts anchored at the dying particle's simulation-space
 * position; because the parent slot is dead (or recycled to a newer spawn
 * generation), the shared tracker advance holds that anchor fixed while the
 * child effect plays out its rate-over-time and burst emission there.
 */
function seedParticleDeathSubEmissionTrackers(options: {
  readonly parentCpu: ParticleEmitterCpuStateResource;
  readonly childCpu: ParticleEmitterCpuStateResource;
  readonly parentEmitter: ParticleEmitterPacket;
  readonly snapshot: RenderSnapshot;
  readonly subEmitterIndex: number;
  readonly probability: number;
}): void {
  const cpu = options.childCpu;

  for (
    let deathIndex = 0;
    deathIndex < options.parentCpu.deathCount;
    deathIndex += 1
  ) {
    const parentSlot = options.parentCpu.deathSlots[deathIndex] ?? -1;
    if (parentSlot < 0) {
      continue;
    }
    const parentGeneration =
      options.parentCpu.deathGenerations[deathIndex] ?? 0;
    // The slot index joins the roll so same-generation deaths from different
    // slots decide their spawn probability independently.
    const roll = particleRandomUnit(
      options.parentEmitter.seed,
      options.parentEmitter.seed ^
        (parentSlot * 747796405) ^
        (parentGeneration * 1597334677) ^
        ((options.subEmitterIndex + 1) * 3812015801),
    );
    if (roll > options.probability) {
      continue;
    }

    const tracker =
      cpu.subEmissionTrackerPool.pop() ?? createParticleSubEmissionTracker();
    const sourceOffset = deathIndex * 3;
    const deathPosition = particleCpuPositionWorld(
      options.snapshot,
      options.parentEmitter,
      [
        options.parentCpu.deathPositions[sourceOffset] ?? 0,
        options.parentCpu.deathPositions[sourceOffset + 1] ?? 0,
        options.parentCpu.deathPositions[sourceOffset + 2] ?? 0,
      ],
    );
    tracker.parentSlot = parentSlot;
    tracker.parentGeneration = parentGeneration;
    tracker.time = 0;
    tracker.spawnAccumulator = 0;
    tracker.previousX = deathPosition[0];
    tracker.previousY = deathPosition[1];
    tracker.previousZ = deathPosition[2];
    tracker.firstUpdate = true;
    cpu.subEmissionTrackers.push(tracker);
  }
}

function createParticleSubEmissionTracker(): ParticleSubEmissionTracker {
  return {
    parentSlot: -1,
    parentGeneration: 0,
    time: 0,
    spawnAccumulator: 0,
    previousX: 0,
    previousY: 0,
    previousZ: 0,
    firstUpdate: true,
  };
}

function particleSubEmitterBurstCount(options: {
  readonly effect: ParticleEmitterEffectAsset;
  readonly emitter: ParticleEmitterPacket;
  readonly tracker: ParticleSubEmissionTracker;
  readonly startTime: number;
  readonly endTime: number;
  readonly includeInitialBurst: boolean;
}): number {
  let count = 0;
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
      // The general window can never contain t=0, so the authored t=0 burst
      // fires through the tracker's one-shot first-advance flag. That keeps
      // it from re-firing when the tracker was seeded on a zero-delta frame.
      if (
        !(
          (burstTime > options.startTime && burstTime <= options.endTime) ||
          (options.includeInitialBurst && burstTime === 0)
        )
      ) {
        continue;
      }
      const roll = particleRandomUnit(
        options.emitter.seed,
        options.emitter.seed ^
          (options.tracker.parentGeneration * 747796405) ^
          (burstIndex * 1597334677) ^
          (cycleIndex * 3812015801),
      );
      if (roll <= clamp01(burst.probability)) {
        count += burst.count;
      }
    }
  }
  return count;
}

function spawnParticleSubEmitterCount(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly position: readonly [number, number, number];
  readonly count: number;
  readonly emitterT: number;
}): void {
  let remaining = Math.max(0, Math.trunc(options.count));
  while (remaining > 0) {
    const slot = nextDeadParticleSlot(options.cpu);
    if (slot < 0) {
      return;
    }
    spawnParticleSubEmitterSlot({ ...options, index: slot });
    remaining -= 1;
  }
}

function spawnParticleSubEmitterSlot(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly position: readonly [number, number, number];
  readonly index: number;
  readonly emitterT: number;
}): void {
  const serial = options.cpu.spawnSerial;
  options.cpu.spawnSerial += 1;
  const r0 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 747796405),
  );
  const r1 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 277803737),
  );
  const r2 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 1442695041),
  );
  const r3 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 1597334677),
  );
  const r4 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 2891336453),
  );
  const r5 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 1013904223),
  );
  const direction = randomUnitVector(r0, r1, false);
  const offset = options.index * 3;
  const lifetime = Math.max(
    0.001,
    sampleParticleScalarAtEmitterTime(
      options.effect.main.startLifetime,
      options.emitterT,
      r3,
      lerp(
        options.effect.runtime.lifetime.min,
        options.effect.runtime.lifetime.max,
        r3,
      ),
    ),
  );
  options.cpu.positions[offset] = options.position[0];
  options.cpu.positions[offset + 1] = options.position[1];
  options.cpu.positions[offset + 2] = options.position[2];
  const speed = sampleParticleScalarAtEmitterTime(
    options.effect.main.startSpeed,
    options.emitterT,
    r4,
    lerp(
      options.effect.runtime.startSpeed.min,
      options.effect.runtime.startSpeed.max,
      r4,
    ),
  );
  options.cpu.velocities[offset] = direction[0] * speed;
  options.cpu.velocities[offset + 1] = direction[1] * speed;
  options.cpu.velocities[offset + 2] = direction[2] * speed;
  options.cpu.lifetimes[options.index] = lifetime;
  options.cpu.ages[options.index] = 0;
  options.cpu.presentationAges[options.index] = 0;
  options.cpu.presentationRenderAges[options.index] = 0;
  options.cpu.rotations[options.index] = sampleParticleScalarAtEmitterTime(
    options.effect.main.startRotation,
    options.emitterT,
    r0,
    lerp(
      options.effect.runtime.startRotation.min,
      options.effect.runtime.startRotation.max,
      r0,
    ),
  );
  options.cpu.angularVelocities[options.index] = lerp(
    options.effect.runtime.angularVelocity.min,
    options.effect.runtime.angularVelocity.max,
    r1,
  );
  options.cpu.frameRandoms[options.index] = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 3266489917),
  );
  options.cpu.baseSizes[options.index] = Math.max(
    0.001,
    sampleParticleScalarAtEmitterTime(
      options.effect.main.startSize,
      options.emitterT,
      r5,
      lerp(
        options.effect.runtime.startSize.min,
        options.effect.runtime.startSize.max,
        r5,
      ),
    ),
  );
  writeParticleStartColor(
    options.cpu,
    options.index,
    options.effect.main.startColor,
    r2,
    options.emitterT,
  );
  options.cpu.maxLifetime = Math.max(options.cpu.maxLifetime, lifetime);
}

function particleCpuPositionWorld(
  snapshot: RenderSnapshot,
  emitter: ParticleEmitterPacket,
  position: readonly [number, number, number],
): readonly [number, number, number] {
  return emitter.simulationSpace === "local"
    ? transformParticlePoint(emitterWorldTransform(snapshot, emitter), position)
    : position;
}

function updateParticleBurstCpuData(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEmitterEffectAsset;
  readonly snapshot: RenderSnapshot;
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

  // Reset the per-frame birth/death event logs before initialization so the
  // one-shot burst spawn (which records every slot as a birth) is observable
  // by subemitter units on exactly the frame it happens.
  options.cpu.birthCount = 0;
  options.cpu.deathCount = 0;
  const wasInitialized = options.cpu.initialized;
  ensureParticleBurstCpuInitialized(options);
  rebaseParticleBurstCpuPositions(options.cpu, options.emitter);
  const localSimulation = options.emitter.simulationSpace === "local";

  const rawDelta = options.time - options.cpu.lastTime;
  const authoritativeTime = particleEmitterPlaybackSimulationTime(
    options.emitter,
    options.effect,
  );
  const delta = !wasInitialized
    ? options.cpu.simulatedTime
    : authoritativeTime !== null
      ? Math.max(0, authoritativeTime - options.cpu.simulatedTime)
      : !Number.isFinite(rawDelta) || rawDelta <= 0
        ? 0
        : Math.min(rawDelta, 1 / 15) *
          options.emitter.timeScale *
          options.effect.runtime.simulationSpeed;
  if (wasInitialized) {
    options.cpu.simulatedTime =
      authoritativeTime === null
        ? options.cpu.simulatedTime + delta
        : Math.max(options.cpu.simulatedTime, authoritativeTime);
  }
  options.cpu.lastTime = options.time;

  const worldTransform = localSimulation
    ? emitterWorldTransform(options.snapshot, options.emitter)
    : null;
  let liveParticles: number;
  let remainingDelta = delta;

  // A fresh offline renderer can first observe a burst several frames into
  // its authored lifetime. Replaying in fixed slices preserves Quarks'
  // behavior-before-age ordering and its per-frame damping instead of
  // collapsing the whole gap into one large Euler step.
  do {
    const stepDelta = Math.min(remainingDelta, 1 / 60);
    liveParticles = writeParticleCpuBuffer({
      cpu: options.cpu,
      effect: options.effect,
      delta: stepDelta,
      // The burst packet position is the shared emission origin, so it is
      // the orbital-velocity pivot (mirroring the continuous path's emitter
      // world origin). Collision stays off: burst buffers do not implement
      // the world-plane response yet.
      origin: options.emitter.burst.position,
      worldTransform,
      applyContinuousModules: true,
      applyCollision: false,
    });
    remainingDelta = Math.max(0, remainingDelta - stepDelta);
  } while (remainingDelta > 0.0000001);

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
  // Epoch zero is the boot-time emitter contract. A non-zero epoch denotes a
  // play/restart authored after boot, so its lifecycle begins when the
  // renderer first observes that epoch rather than inheriting global app
  // time. This also makes dynamically spawned ECS emitters reliable.
  const lifecycleStart =
    options.emitter.lifecycleStartTime ??
    (options.emitter.resetEpoch > 0 ? options.time : 0);
  options.cpu.startTime = lifecycleStart;
  options.cpu.lastTime = lifecycleStart;

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
      emitterT: targetCount <= 1 ? 0 : index / (targetCount - 1),
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

  const elapsed = Math.max(0, options.cpu.simulatedTime);
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

  spawnParticleContinuousCount({
    ...options,
    count: spawnCount,
    age: 0,
    emitterT: clamp01(loopTime / duration),
  });

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
  readonly emitterT: number;
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
      emitterT: options.emitterT,
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
      const roll = particleRandomUnit(
        options.emitter.seed,
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
        // The simulation pass below advances every live particle by this
        // window's delta. Starting a just-born burst at its window-relative
        // age as well would advance it twice (a t=0 burst observed at 1/60 s
        // landed at 2/60 s). Quarks emits the burst, then advances it once.
        age: 0,
        emitterT: clamp01(
          burstTime / Math.max(0.001, options.effect.runtime.duration),
        ),
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
  readonly emitterT: number;
}): void {
  const serial = options.cpu.spawnSerial;
  options.cpu.spawnSerial += 1;

  const r0 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 747796405),
  );
  const r1 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 277803737),
  );
  const r2 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 1442695041),
  );
  const r3 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 1597334677),
  );
  const r4 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 2891336453),
  );
  const r5 = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 1013904223),
  );
  const lifetime = Math.max(
    0.001,
    sampleParticleScalarAtEmitterTime(
      options.effect.main.startLifetime,
      options.emitterT,
      r3,
      lerp(
        options.effect.runtime.lifetime.min,
        options.effect.runtime.lifetime.max,
        r3,
      ),
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
  options.cpu.spawnGenerations[options.index] =
    ((options.cpu.spawnGenerations[options.index] ?? 0) + 1) >>> 0;
  if (options.cpu.birthCount < options.cpu.birthSlots.length) {
    options.cpu.birthSlots[options.cpu.birthCount] = options.index;
    options.cpu.birthCount += 1;
  }
  options.cpu.birthPositions[sourceOffset] = sample.position[0];
  options.cpu.birthPositions[sourceOffset + 1] = sample.position[1];
  options.cpu.birthPositions[sourceOffset + 2] = sample.position[2];
  const startSpeed = sampleParticleScalarAtEmitterTime(
    options.effect.main.startSpeed,
    options.emitterT,
    r4,
    lerp(
      options.effect.runtime.startSpeed.min,
      options.effect.runtime.startSpeed.max,
      r4,
    ),
  );
  options.cpu.velocities[sourceOffset] = sample.direction[0] * startSpeed;
  options.cpu.velocities[sourceOffset + 1] = sample.direction[1] * startSpeed;
  options.cpu.velocities[sourceOffset + 2] = sample.direction[2] * startSpeed;
  options.cpu.lifetimes[options.index] = lifetime;
  options.cpu.ages[options.index] = initialAge;
  options.cpu.rotations[options.index] = sampleParticleScalarAtEmitterTime(
    options.effect.main.startRotation,
    options.emitterT,
    r0,
    lerp(
      options.effect.runtime.startRotation.min,
      options.effect.runtime.startRotation.max,
      r0,
    ),
  );
  options.cpu.angularVelocities[options.index] = lerp(
    options.effect.runtime.angularVelocity.min,
    options.effect.runtime.angularVelocity.max,
    r1,
  );
  options.cpu.frameRandoms[options.index] = particleRandomUnit(
    options.emitter.seed,
    particleRandomStreamValue(options.emitter.seed, serial, 3266489917),
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
    sampleParticleScalarAtEmitterTime(
      options.effect.main.startSize,
      options.emitterT,
      r5,
      lerp(
        options.effect.runtime.startSize.min,
        options.effect.runtime.startSize.max,
        r5,
      ),
    ) * sample.sizeScale,
  );
  writeParticleStartColor(
    options.cpu,
    options.index,
    options.effect.main.startColor,
    r2,
    options.emitterT,
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
  readonly sizeScale: number;
} {
  const localSimulation = options.emitter.simulationSpace === "local";
  const worldTransform = emitterWorldTransform(
    options.snapshot,
    options.emitter,
  );
  const sample = sampleParticleShapeLocal({
    effect: options.effect,
    random: options.random,
  });

  return localSimulation
    ? { ...sample, sizeScale: 1 }
    : {
        position: transformParticlePoint(worldTransform, sample.position),
        direction: transformParticleVector(worldTransform, sample.direction),
        sizeScale: particleTransformUniformScale(worldTransform),
      };
}

function sampleParticleShapeLocal(options: {
  readonly effect: ParticleEmitterEffectAsset;
  readonly random: readonly [number, number, number, number, number, number];
}): {
  readonly position: readonly [number, number, number];
  readonly direction: readonly [number, number, number];
} {
  const origin: readonly [number, number, number] = [0, 0, 0];
  const shape = options.effect.shape;
  const unit = randomUnitVector(
    options.random[0],
    options.random[1],
    shape.type === "hemisphere",
  );
  const radius = Math.max(0, shape.radius);
  const shellMin = radius * (1 - clamp01(shape.radiusThickness));
  const shellRadius = lerp(shellMin, radius, options.random[2]);
  const finish = (
    position: readonly [number, number, number],
    direction: readonly [number, number, number],
  ) => {
    const scaledDirection: readonly [number, number, number] = [
      direction[0] * (shape.directionScale[0] ?? 1),
      direction[1] * (shape.directionScale[1] ?? 1),
      direction[2] * (shape.directionScale[2] ?? 1),
    ];

    return { position, direction: scaledDirection };
  };

  if (!shape.enabled || shape.type === "point") {
    const radial =
      shape.type === "point" && shape.coneDirectionMode === "quarks"
        ? Math.cbrt(options.random[2])
        : 1;
    const pointDirection: readonly [number, number, number] = [
      unit[0] * radial,
      unit[1] * radial,
      unit[2] * radial,
    ];
    return finish(origin, pointDirection);
  }

  if (shape.type === "sphere" || shape.type === "hemisphere") {
    return finish(
      [
        origin[0] + unit[0] * shellRadius,
        origin[1] + unit[1] * shellRadius,
        origin[2] + unit[2] * shellRadius,
      ],
      unit,
    );
  }

  if (shape.type === "circle") {
    const angle = options.random[0] * Math.PI * 2;
    const circleRadius =
      lerp(1 - clamp01(shape.radiusThickness), 1, options.random[1]) * radius;
    const direction = normalize3([Math.cos(angle), Math.sin(angle), 0]);

    return finish(
      [
        origin[0] + direction[0] * circleRadius,
        origin[1] + direction[1] * circleRadius,
        origin[2],
      ],
      direction,
    );
  }

  if (shape.type === "donut") {
    const angle = options.random[0] * Math.PI * 2;
    const innerRadius = radius * (1 - clamp01(shape.radiusThickness));
    const donutRadius = lerp(innerRadius, radius, Math.sqrt(options.random[1]));
    const direction = normalize3([Math.cos(angle), Math.sin(angle), 0]);

    return finish(
      [
        origin[0] + direction[0] * donutRadius,
        origin[1] + direction[1] * donutRadius,
        origin[2],
      ],
      direction,
    );
  }

  if (shape.type === "rectangle") {
    const box = shape.box;
    const width = Math.max(0, box[0] ?? 0);
    const height = Math.max(0, box[1] ?? 0);

    return finish(
      [
        origin[0] + (options.random[0] - 0.5) * width,
        origin[1] + (options.random[1] - 0.5) * height,
        origin[2],
      ],
      unit,
    );
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

    return finish(
      [
        origin[0] + gridCoordinate(column, columns, Math.max(0, box[0] ?? 0)),
        origin[1] + gridCoordinate(row, rows, Math.max(0, box[1] ?? 0)),
        origin[2] + gridCoordinate(layer, layers, Math.max(0, box[2] ?? 0)),
      ],
      unit,
    );
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
        return finish(
          [
            origin[0] + halfX,
            origin[1] + u * extents[1],
            origin[2] + v * extents[2],
          ],
          [1, 0, 0],
        );
      case 1:
        return finish(
          [
            origin[0] - halfX,
            origin[1] + u * extents[1],
            origin[2] + v * extents[2],
          ],
          [-1, 0, 0],
        );
      case 2:
        return finish(
          [
            origin[0] + u * extents[0],
            origin[1] + halfY,
            origin[2] + v * extents[2],
          ],
          [0, 1, 0],
        );
      case 3:
        return finish(
          [
            origin[0] + u * extents[0],
            origin[1] - halfY,
            origin[2] + v * extents[2],
          ],
          [0, -1, 0],
        );
      case 4:
        return finish(
          [
            origin[0] + u * extents[0],
            origin[1] + v * extents[1],
            origin[2] + halfZ,
          ],
          [0, 0, 1],
        );
      default:
        return finish(
          [
            origin[0] + u * extents[0],
            origin[1] + v * extents[1],
            origin[2] - halfZ,
          ],
          [0, 0, -1],
        );
    }
  }

  if (shape.type === "cone") {
    const angle = options.random[0] * Math.PI * 2;
    const radialFraction = Math.sqrt(
      lerp(1 - clamp01(shape.radiusThickness), 1, options.random[1]),
    );
    const coneRadius = radialFraction * radius;
    const coneAngle =
      ((Math.max(0, shape.angle) * Math.PI) / 180) * radialFraction;
    const lateralScale =
      shape.coneDirectionMode === "quarks" ? radialFraction : 1;
    const sampledDirection: readonly [number, number, number] = [
      Math.cos(angle) * lateralScale * Math.sin(coneAngle),
      Math.sin(angle) * lateralScale * Math.sin(coneAngle),
      Math.cos(coneAngle),
    ];
    const direction =
      shape.coneDirectionMode === "quarks"
        ? sampledDirection
        : normalize3(sampledDirection);

    return finish(
      [
        origin[0] + Math.cos(angle) * coneRadius,
        origin[1] + Math.sin(angle) * coneRadius,
        origin[2],
      ],
      direction,
    );
  }

  if (shape.type === "box") {
    const box = shape.box;

    return finish(
      [
        origin[0] + (options.random[0] - 0.5) * Math.max(0, box[0] ?? 0),
        origin[1] + (options.random[1] - 0.5) * Math.max(0, box[1] ?? 0),
        origin[2] + (options.random[2] - 0.5) * Math.max(0, box[2] ?? 0),
      ],
      unit,
    );
  }

  return finish(origin, unit);
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
  const authoritativeTime = particleEmitterPlaybackSimulationTime(
    options.emitter,
    options.effect,
  );
  options.cpu.simulatedTime =
    authoritativeTime ??
    Math.max(0, options.time - options.cpu.startTime) *
      Math.max(0, options.emitter.timeScale) *
      Math.max(0, options.effect.runtime.simulationSpeed);
  options.cpu.lastTime = options.time;
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

  const speedScale = Math.max(0, burst.speedScale ?? 1);
  const lifetimeScale = Math.max(0, burst.lifetimeScale ?? 1);
  let maxLifetime = 0;
  const uniformLifetime =
    options.effect.runtime.lifetime.min === options.effect.runtime.lifetime.max;

  for (let index = 0; index < options.emitter.capacity; index += 1) {
    const offset = index * 3;
    const r0 = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 747796405),
    );
    const r1 = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 277803737),
    );
    const r2 = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 1442695041),
    );
    const r3 = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 1597334677),
    );
    const r4 = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 2891336453),
    );
    const r5 = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 1013904223),
    );
    const shapeSample = sampleParticleShapeLocal({
      effect: options.effect,
      random: [r0, r1, r2, r3, r4, r5],
    });
    const rotation = burst.rotation ?? ([0, 0, 0, 1] as const);
    const birthOffset = rotateParticleVectorByQuaternion(
      [
        lerp(burst.positionJitterMin[0], burst.positionJitterMax[0], r0) +
          shapeSample.position[0],
        lerp(burst.positionJitterMin[1], burst.positionJitterMax[1], r1) +
          shapeSample.position[1],
        lerp(burst.positionJitterMin[2], burst.positionJitterMax[2], r2) +
          shapeSample.position[2],
      ],
      rotation,
    );

    options.cpu.positions[offset] = burst.position[0] + birthOffset[0];
    options.cpu.positions[offset + 1] = burst.position[1] + birthOffset[1];
    options.cpu.positions[offset + 2] = burst.position[2] + birthOffset[2];
    // The one-shot spawn is this burst's birth event log: birth subemitters on
    // burst parents consume it the same way they consume continuous births.
    options.cpu.spawnGenerations[index] =
      ((options.cpu.spawnGenerations[index] ?? 0) + 1) >>> 0;
    if (options.cpu.birthCount < options.cpu.birthSlots.length) {
      options.cpu.birthSlots[options.cpu.birthCount] = index;
      options.cpu.birthCount += 1;
    }
    options.cpu.birthPositions[offset] = options.cpu.positions[offset] ?? 0;
    options.cpu.birthPositions[offset + 1] =
      options.cpu.positions[offset + 1] ?? 0;
    options.cpu.birthPositions[offset + 2] =
      options.cpu.positions[offset + 2] ?? 0;
    const authoredSpeed =
      sampleParticleScalarAtEmitterTime(
        options.effect.main.startSpeed,
        0,
        r4,
        lerp(
          options.effect.runtime.startSpeed.min,
          options.effect.runtime.startSpeed.max,
          r4,
        ),
      ) * speedScale;
    const birthVelocity = rotateParticleVectorByQuaternion(
      [
        lerp(burst.velocityMin[0], burst.velocityMax[0], r2) +
          options.effect.runtime.velocityOverLifetime[0] +
          shapeSample.direction[0] * authoredSpeed,
        lerp(burst.velocityMin[1], burst.velocityMax[1], r3) +
          options.effect.runtime.velocityOverLifetime[1] +
          shapeSample.direction[1] * authoredSpeed,
        lerp(burst.velocityMin[2], burst.velocityMax[2], r4) +
          options.effect.runtime.velocityOverLifetime[2] +
          shapeSample.direction[2] * authoredSpeed,
      ],
      rotation,
    );
    options.cpu.velocities[offset] = birthVelocity[0];
    options.cpu.velocities[offset + 1] = birthVelocity[1];
    options.cpu.velocities[offset + 2] = birthVelocity[2];
    options.cpu.ages[index] = 0;
    options.cpu.presentationAges[index] = 0;
    options.cpu.presentationRenderAges[index] = 0;
    const lifetime = Math.max(
      0.001,
      sampleParticleScalarAtEmitterTime(
        options.effect.main.startLifetime,
        0,
        r3,
        lerp(
          options.effect.runtime.lifetime.min,
          options.effect.runtime.lifetime.max,
          r3,
        ),
      ) * lifetimeScale,
    );
    options.cpu.lifetimes[index] = lifetime;
    maxLifetime = Math.max(maxLifetime, lifetime);
    options.cpu.baseSizes[index] = Math.max(
      0.001,
      sampleParticleScalarAtEmitterTime(
        options.effect.main.startSize,
        0,
        r5,
        lerp(
          options.effect.runtime.startSize.min,
          options.effect.runtime.startSize.max,
          r5,
        ),
      ) * burst.sizeScale,
    );
    writeParticleStartColor(
      options.cpu,
      index,
      options.effect.main.startColor,
      r2,
      0,
    );
    options.cpu.rotations[index] = sampleParticleScalarAtEmitterTime(
      options.effect.main.startRotation,
      0,
      r0,
      lerp(
        options.effect.runtime.startRotation.min,
        options.effect.runtime.startRotation.max,
        r0,
      ),
    );
    options.cpu.angularVelocities[index] = lerp(
      options.effect.runtime.angularVelocity.min,
      options.effect.runtime.angularVelocity.max,
      r1,
    );
    options.cpu.frameRandoms[index] = particleRandomUnit(
      options.emitter.seed,
      particleRandomStreamValue(options.emitter.seed, index, 3266489917),
    );
  }

  options.cpu.colorTint[0] = burst.colorTint[0];
  options.cpu.colorTint[1] = burst.colorTint[1];
  options.cpu.colorTint[2] = burst.colorTint[2];
  options.cpu.colorTint[3] = burst.colorTint[3];
  options.cpu.maxLifetime = maxLifetime;
  options.cpu.uniformLifetime = uniformLifetime;
  options.cpu.lastOriginX = burst.position[0];
  options.cpu.lastOriginY = burst.position[1];
  options.cpu.lastOriginZ = burst.position[2];
  options.cpu.hasLastOrigin = true;
}

function rotateParticleVectorByQuaternion(
  vector: readonly [number, number, number],
  quaternion: readonly [number, number, number, number],
): readonly [number, number, number] {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

/**
 * Move every already-born transient particle by the burst packet's changing
 * shared origin. The packet position is absolute (`request + mutable root`);
 * keeping the cached CPU positions in that same frame reproduces particle
 * engines that translate one world root after emission.
 */
function rebaseParticleBurstCpuPositions(
  cpu: ParticleEmitterCpuStateResource,
  emitter: ParticleEmitterPacket,
): void {
  const position = emitter.burst?.position;
  if (position === undefined) {
    return;
  }

  if (!cpu.hasLastOrigin) {
    cpu.lastOriginX = position[0];
    cpu.lastOriginY = position[1];
    cpu.lastOriginZ = position[2];
    cpu.hasLastOrigin = true;
    return;
  }

  const dx = position[0] - cpu.lastOriginX;
  const dy = position[1] - cpu.lastOriginY;
  const dz = position[2] - cpu.lastOriginZ;
  cpu.lastOriginX = position[0];
  cpu.lastOriginY = position[1];
  cpu.lastOriginZ = position[2];

  if (dx === 0 && dy === 0 && dz === 0) {
    return;
  }

  for (let offset = 0; offset < cpu.positions.length; offset += 3) {
    cpu.positions[offset] = (cpu.positions[offset] ?? 0) + dx;
    cpu.positions[offset + 1] = (cpu.positions[offset + 1] ?? 0) + dy;
    cpu.positions[offset + 2] = (cpu.positions[offset + 2] ?? 0) + dz;
  }
}

function sampleParticleScalarAtEmitterTime(
  input: ParticleEmitterEffectAsset["main"]["startSize"],
  emitterT: number,
  random: number,
  fallback: number,
): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : fallback;
  }
  if (Array.isArray(input) || ArrayBuffer.isView(input)) {
    const value = Number((input as ArrayLike<number>)[0]);
    return Number.isFinite(value) ? value : fallback;
  }
  if (input === null || typeof input !== "object") {
    return fallback;
  }

  const value = input as unknown as Record<string, unknown>;
  const mode = value["mode"];
  if (mode === "constant") {
    const constant = value["value"];
    if (typeof constant === "number") {
      return Number.isFinite(constant) ? constant : fallback;
    }
    if (Array.isArray(constant) || ArrayBuffer.isView(constant)) {
      const component = Number((constant as ArrayLike<number>)[0]);
      return Number.isFinite(component) ? component : fallback;
    }
  }
  if (mode === "random-between-two-constants") {
    const min = finiteNumber(value["min"], fallback);
    const max = finiteNumber(value["max"], min);
    return lerp(min, max, clamp01(random));
  }
  if (mode === "curve" && Array.isArray(value["curve"])) {
    return (
      sampleParticleAuthoringCurve(value["curve"], emitterT, fallback) *
      finiteNumber(value["multiplier"], 1)
    );
  }
  if (
    mode === "random-between-two-curves" &&
    Array.isArray(value["minCurve"]) &&
    Array.isArray(value["maxCurve"])
  ) {
    const min = sampleParticleAuthoringCurve(
      value["minCurve"],
      emitterT,
      fallback,
    );
    const max = sampleParticleAuthoringCurve(
      value["maxCurve"],
      emitterT,
      fallback,
    );
    return (
      lerp(min, max, clamp01(random)) * finiteNumber(value["multiplier"], 1)
    );
  }

  const min = finiteNumber(value["min"], fallback);
  const max = finiteNumber(value["max"], min);
  return lerp(min, max, clamp01(random));
}

function sampleParticleAuthoringCurve(
  keys: readonly unknown[],
  t: number,
  fallback: number,
): number {
  const curve = keys
    .map((key) => {
      if (key === null || typeof key !== "object") {
        return null;
      }
      const record = key as Record<string, unknown>;
      const keyT = Number(record["t"]);
      const keyValue = Number(record["value"]);
      return Number.isFinite(keyT) && Number.isFinite(keyValue)
        ? { t: keyT, value: keyValue }
        : null;
    })
    .filter(
      (key): key is { readonly t: number; readonly value: number } =>
        key !== null,
    )
    .sort((a, b) => a.t - b.t);
  if (curve.length === 0) {
    return fallback;
  }

  const sampleT = clamp01(t);
  const first = curve[0]!;
  if (sampleT <= first.t) {
    return first.value;
  }
  const last = curve[curve.length - 1]!;
  if (sampleT >= last.t) {
    return last.value;
  }
  for (let index = 1; index < curve.length; index += 1) {
    const next = curve[index]!;
    if (sampleT > next.t) {
      continue;
    }
    const previous = curve[index - 1]!;
    const span = Math.max(0.000001, next.t - previous.t);
    return lerp(
      previous.value,
      next.value,
      clamp01((sampleT - previous.t) / span),
    );
  }
  return last.value;
}

function writeParticleStartColor(
  cpu: ParticleEmitterCpuStateResource,
  index: number,
  input: ParticleColorValue,
  random: number,
  emitterT: number,
): void {
  let min: readonly [number, number, number, number];
  let max: readonly [number, number, number, number];

  if (typeof input === "object" && input !== null && "mode" in input) {
    switch (input.mode) {
      case "constant":
        min = max = tuple4(input.color);
        break;
      case "random-between-two-colors":
        min = tuple4(input.min);
        max = tuple4(input.max);
        break;
      case "gradient":
        min = max = sampleParticleAuthoringGradient(input.gradient, emitterT);
        break;
      case "random-between-two-gradients":
        min = sampleParticleAuthoringGradient(input.minGradient, emitterT);
        max = sampleParticleAuthoringGradient(input.maxGradient, emitterT);
        break;
    }
  } else {
    min = max = tuple4(input);
  }

  const offset = index * 4;
  cpu.startColors[offset] = lerp(min[0], max[0], random);
  cpu.startColors[offset + 1] = lerp(min[1], max[1], random);
  cpu.startColors[offset + 2] = lerp(min[2], max[2], random);
  cpu.startColors[offset + 3] = lerp(min[3], max[3], random);
}

function sampleParticleAuthoringGradient(
  keys: readonly ParticleGradientKeyframe[],
  t: number,
): readonly [number, number, number, number] {
  const gradient = [...keys].sort((a, b) => a.t - b.t);
  if (gradient.length === 0) {
    return [1, 1, 1, 1];
  }
  const sampleT = clamp01(t);
  const first = gradient[0]!;
  if (sampleT <= first.t) {
    return tuple4(first.color);
  }
  const last = gradient[gradient.length - 1]!;
  if (sampleT >= last.t) {
    return tuple4(last.color);
  }
  for (let index = 1; index < gradient.length; index += 1) {
    const next = gradient[index]!;
    if (sampleT > next.t) {
      continue;
    }
    const previous = gradient[index - 1]!;
    const a = tuple4(previous.color);
    const b = tuple4(next.color);
    const span = Math.max(0.000001, next.t - previous.t);
    const factor = clamp01((sampleT - previous.t) / span);
    return [
      lerp(a[0], b[0], factor),
      lerp(a[1], b[1], factor),
      lerp(a[2], b[2], factor),
      lerp(a[3], b[3], factor),
    ];
  }
  return tuple4(last.color);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function particleEmitterPlaybackSimulationTime(
  emitter: ParticleEmitterPacket,
  effect: ParticleEmitterEffectAsset,
): number | null {
  const playbackTime = emitter.playbackTime;
  if (
    playbackTime === undefined ||
    !Number.isFinite(playbackTime) ||
    playbackTime < 0
  ) {
    return null;
  }

  return (
    playbackTime * Math.max(0, finiteNumber(effect.runtime.simulationSpeed, 1))
  );
}

function writeParticleCpuBuffer(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly effect: ParticleEmitterEffectAsset;
  readonly delta: number;
  readonly origin: readonly [number, number, number];
  readonly worldTransform?: ArrayLike<number> | null;
  readonly applyContinuousModules: boolean;
  /** Defaults to `applyContinuousModules`; bursts apply motion modules but
   * keep the world-plane collision response off. */
  readonly applyCollision?: boolean;
}): number {
  let live = 0;

  for (let index = 0; index < options.cpu.ages.length; index += 1) {
    const lifetime = options.cpu.lifetimes[index] ?? 0;
    const previousAge = options.cpu.ages[index] ?? 0;
    const presentationAge =
      options.delta > 0
        ? previousAge
        : (options.cpu.presentationAges[index] ?? previousAge);
    let age = previousAge + options.delta;
    const presentationRenderAge =
      options.delta > 0
        ? age
        : (options.cpu.presentationRenderAges[index] ?? age);

    if (age >= lifetime) {
      if (previousAge < lifetime && lifetime > 0) {
        const deathOffset = index * 3;
        recordParticleDeath(
          options.cpu,
          index,
          options.cpu.positions[deathOffset] ?? 0,
          options.cpu.positions[deathOffset + 1] ?? 0,
          options.cpu.positions[deathOffset + 2] ?? 0,
        );
      }
      options.cpu.ages[index] = lifetime;
      continue;
    }

    options.cpu.ages[index] = age;
    // three.quarks evaluates every behavior module before integrating
    // position and incrementing age. Ported Quarks effects therefore sample
    // size/color/speed curves from the age at the start of this step.
    let lifeT = clamp01(presentationAge / lifetime);
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
    const rawVelocityX = options.cpu.velocities[sourceOffset] ?? 0;
    const rawVelocityY = options.cpu.velocities[sourceOffset + 1] ?? 0;
    const rawVelocityZ = options.cpu.velocities[sourceOffset + 2] ?? 0;
    const rawVelocitySpeed = Math.hypot(
      rawVelocityX,
      rawVelocityY,
      rawVelocityZ,
    );
    if (
      options.effect.runtime.linearDamping > 0 &&
      rawVelocitySpeed > options.effect.runtime.maxSpeed
    ) {
      const excessFraction =
        (rawVelocitySpeed - options.effect.runtime.maxSpeed) / rawVelocitySpeed;
      const dampingFactor = Math.max(
        0,
        1 -
          excessFraction *
            options.effect.runtime.linearDamping *
            options.delta *
            20,
      );

      options.cpu.velocities[sourceOffset] = rawVelocityX * dampingFactor;
      options.cpu.velocities[sourceOffset + 1] = rawVelocityY * dampingFactor;
      options.cpu.velocities[sourceOffset + 2] = rawVelocityZ * dampingFactor;
    }
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
        age: presentationAge,
        lifeT,
      });

      motionX += moduleMotion[0];
      motionY += moduleMotion[1];
      motionZ += moduleMotion[2];
    }
    const nextX =
      (options.cpu.positions[sourceOffset] ?? 0) + motionX * options.delta;
    let nextY =
      (options.cpu.positions[sourceOffset + 1] ?? 0) + motionY * options.delta;
    const nextZ =
      (options.cpu.positions[sourceOffset + 2] ?? 0) + motionZ * options.delta;

    if (
      (options.applyCollision ?? options.applyContinuousModules) &&
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
          lifeT = clamp01(Math.min(presentationAge, age) / lifetime);

          if (age >= lifetime) {
            recordParticleDeath(options.cpu, index, nextX, nextY, nextZ);
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

    const simulationPosition: readonly [number, number, number] = [
      options.cpu.positions[sourceOffset] ?? 0,
      options.cpu.positions[sourceOffset + 1] ?? 0,
      options.cpu.positions[sourceOffset + 2] ?? 0,
    ];
    const renderPosition =
      options.worldTransform === undefined || options.worldTransform === null
        ? simulationPosition
        : transformParticlePoint(options.worldTransform, simulationPosition);
    const renderMotion =
      options.worldTransform === undefined || options.worldTransform === null
        ? ([motionX, motionY, motionZ] as const)
        : transformParticleVector(options.worldTransform, [
            motionX,
            motionY,
            motionZ,
          ]);
    const packedMotion =
      options.effect.runtime.renderMode === "stretched-billboard"
        ? ([
            renderMotion[0] *
              Math.max(0.001, options.effect.runtime.stretchedSpeedFactor),
            renderMotion[1] *
              Math.max(0.001, options.effect.runtime.stretchedSpeedFactor),
            renderMotion[2] *
              Math.max(0.001, options.effect.runtime.stretchedSpeedFactor),
          ] as const)
        : renderMotion;
    const renderSize =
      particleSize *
      (options.worldTransform === undefined || options.worldTransform === null
        ? 1
        : particleTransformUniformScale(options.worldTransform));

    options.cpu.bufferData[outputOffset] = renderPosition[0];
    options.cpu.bufferData[outputOffset + 1] = renderPosition[1];
    options.cpu.bufferData[outputOffset + 2] = renderPosition[2];
    options.cpu.bufferData[outputOffset + 3] = renderSize;
    const tint = options.cpu.colorTint;
    const startColorOffset = index * 4;
    options.cpu.bufferData[outputOffset + 4] =
      baseColor[0] *
      speedColor[0] *
      (options.cpu.startColors[startColorOffset] ?? 1) *
      tint[0];
    options.cpu.bufferData[outputOffset + 5] =
      baseColor[1] *
      speedColor[1] *
      (options.cpu.startColors[startColorOffset + 1] ?? 1) *
      tint[1];
    options.cpu.bufferData[outputOffset + 6] =
      baseColor[2] *
      speedColor[2] *
      (options.cpu.startColors[startColorOffset + 2] ?? 1) *
      tint[2];
    options.cpu.bufferData[outputOffset + 7] =
      baseColor[3] *
      speedColor[3] *
      (options.cpu.startColors[startColorOffset + 3] ?? 1) *
      tint[3];
    writeParticleFrameData(options.cpu.bufferData, outputOffset + 8, {
      effect: options.effect,
      lifeT,
      frameRandom: options.cpu.frameRandoms[index] ?? 0,
      rotation:
        (options.cpu.rotations[index] ?? 0) +
        ((options.cpu.angularVelocities[index] ?? 0) + speedAngularVelocity) *
          presentationRenderAge,
    });
    options.cpu.bufferData[outputOffset + 12] = packedMotion[0];
    options.cpu.bufferData[outputOffset + 13] = packedMotion[1];
    options.cpu.bufferData[outputOffset + 14] = packedMotion[2];
    options.cpu.bufferData[outputOffset + 15] =
      options.effect.runtime.renderMode === "stretched-billboard"
        ? options.effect.runtime.stretchedLengthFactor
        : options.effect.runtime.renderMode === "trail" ||
            options.effect.trails.enabled === true
          ? renderMotionLength *
            (options.worldTransform === undefined ||
            options.worldTransform === null
              ? 1
              : particleTransformUniformScale(options.worldTransform))
          : Math.hypot(packedMotion[0], packedMotion[1], packedMotion[2]);
    options.cpu.presentationAges[index] = presentationAge;
    options.cpu.presentationRenderAges[index] = presentationRenderAge;
    live += 1;
  }

  options.cpu.liveCount = live;
  return live;
}

/**
 * Record a particle death event for this simulation update so death-trigger
 * subemitters can seed child emission at the dying particle's last
 * simulation-space position. Events are indexed per occurrence (not per slot)
 * because sliced updates can respawn and re-kill a slot within one frame.
 */
function recordParticleDeath(
  cpu: ParticleEmitterCpuStateResource,
  slot: number,
  x: number,
  y: number,
  z: number,
): void {
  if (cpu.deathCount >= cpu.deathSlots.length) {
    return;
  }

  const event = cpu.deathCount;
  const offset = event * 3;
  cpu.deathSlots[event] = slot;
  cpu.deathGenerations[event] = cpu.spawnGenerations[slot] ?? 0;
  cpu.deathPositions[offset] = x;
  cpu.deathPositions[offset + 1] = y;
  cpu.deathPositions[offset + 2] = z;
  cpu.deathCount += 1;
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

function particleSubEmitterId(
  parentEmitterId: number,
  subEmitterIndex: number,
  effectId: string,
): number {
  let hash =
    (2166136261 ^
      Math.trunc(parentEmitterId) ^
      ((subEmitterIndex + 1) * 2246822519)) >>>
    0;
  for (let index = 0; index < effectId.length; index += 1) {
    hash ^= effectId.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash & 0x7fffffff || 1;
}

function hashUnit(value: number): number {
  let x = value >>> 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
  x = ((x >>> 16) ^ x) >>> 0;
  return (x & 0x00ff_ffff) / 0x0100_0000;
}

function isParticleFixedRandomSeed(seed: number): boolean {
  return (seed | 0) === PARTICLE_FIXED_RANDOM_SEED;
}

function particleRandomStreamValue(
  seed: number,
  particleSerial: number,
  streamSalt: number,
): number {
  return (
    seed ^
    Math.imul((Math.max(0, Math.trunc(particleSerial)) + 1) >>> 0, streamSalt)
  );
}

function particleRandomUnit(seed: number, value: number): number {
  return isParticleFixedRandomSeed(seed) ? 0.5 : hashUnit(value);
}

function writeParticleBurstRenderCurveData(
  floats: Float32Array,
  base: number,
  effect: ParticleEmitterEffectAsset,
): void {
  const sizeCurve = base + PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET;
  const frameCurveMin = base + PARTICLE_BURST_FRAME_CURVE_MIN_FLOAT_OFFSET;
  const frameCurve = base + PARTICLE_BURST_FRAME_CURVE_FLOAT_OFFSET;
  const colorCurve = base + PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET;

  for (let index = 0; index < PARTICLE_CURVE_SAMPLE_COUNT; index += 1) {
    const t = index / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
    const color = samplePackedParticleColorCurve(effect, t);

    floats[sizeCurve + index] = samplePackedParticleSizeCurve(effect, t);
    floats[frameCurveMin + index] = sampleRuntimeScalarCurve(
      effect.runtime.textureSheetFrameOverTimeMin,
      t,
    );
    floats[frameCurve + index] = sampleRuntimeScalarCurve(
      effect.runtime.textureSheetFrameOverTime,
      t,
    );
    floats[colorCurve + index * 4] = color[0];
    floats[colorCurve + index * 4 + 1] = color[1];
    floats[colorCurve + index * 4 + 2] = color[2];
    floats[colorCurve + index * 4 + 3] = color[3];
  }
}

/**
 * Pack the burst modulation-module curve tables: the speedOverLifetime factor
 * curve plus its running integrals (so the burst shader can evaluate the
 * ballistic displacement analytically), the sizeBySpeed curve, and the
 * colorBySpeed gradient. All tables sample the same 16-entry lifetime grid as
 * the existing burst curves.
 */
function writeParticleBurstModuleCurveData(
  floats: Float32Array,
  base: number,
  effect: ParticleEmitterEffectAsset,
): void {
  const speedCurve = effect.runtime.speedOverLifetime;
  const speedBase = base + PARTICLE_BURST_SPEED_CURVE_FLOAT_OFFSET;
  const speedIntegralBase =
    base + PARTICLE_BURST_SPEED_CURVE_INTEGRAL_FLOAT_OFFSET;
  const speedTimeIntegralBase =
    base + PARTICLE_BURST_SPEED_CURVE_TIME_INTEGRAL_FLOAT_OFFSET;
  const sizeBySpeedBase =
    base + PARTICLE_BURST_SIZE_BY_SPEED_CURVE_FLOAT_OFFSET;
  const colorBySpeedBase =
    base + PARTICLE_BURST_COLOR_BY_SPEED_CURVE_FLOAT_OFFSET;
  let speedIntegral = 0;
  let speedTimeIntegral = 0;

  for (let index = 0; index < PARTICLE_CURVE_SAMPLE_COUNT; index += 1) {
    const t = index / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
    const speedColor = sampleRuntimeColorGradient(
      effect.runtime.colorBySpeed,
      t,
    );

    if (index > 0) {
      const previousT = (index - 1) / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
      const interval = integrateParticleSpeedCurveInterval(
        speedCurve,
        previousT,
        t,
      );

      speedIntegral += interval.integral;
      speedTimeIntegral += interval.timeIntegral;
    }

    floats[speedBase + index] = sampleRuntimeScalarCurve(speedCurve, t);
    floats[speedIntegralBase + index] = speedIntegral;
    floats[speedTimeIntegralBase + index] = speedTimeIntegral;
    floats[sizeBySpeedBase + index] = sampleRuntimeScalarCurve(
      effect.runtime.sizeBySpeed,
      t,
    );
    floats[colorBySpeedBase + index * 4] = speedColor[0];
    floats[colorBySpeedBase + index * 4 + 1] = speedColor[1];
    floats[colorBySpeedBase + index * 4 + 2] = speedColor[2];
    floats[colorBySpeedBase + index * 4 + 3] = speedColor[3];
  }
}

/**
 * Composite-Simpson integrals of the speed curve over one table interval:
 * ∫ s(x) dx and ∫ x·s(x) dx. Simpson is exact for the piecewise-linear speed
 * factor and its (quadratic) time-weighted integrand away from knots, so the
 * packed tables reproduce constant and linear authored curves exactly.
 */
function integrateParticleSpeedCurveInterval(
  curve: readonly { readonly t: number; readonly value: number }[],
  startT: number,
  endT: number,
): { readonly integral: number; readonly timeIntegral: number } {
  const steps = 8;
  const h = (endT - startT) / steps;
  let sum = 0;
  let timeSum = 0;

  for (let step = 0; step <= steps; step += 1) {
    const t = startT + h * step;
    const weight = step === 0 || step === steps ? 1 : step % 2 === 1 ? 4 : 2;
    const value = sampleRuntimeScalarCurve(curve, t);

    sum += weight * value;
    timeSum += weight * t * value;
  }

  const scale = h / 3;
  return { integral: sum * scale, timeIntegral: timeSum * scale };
}

/**
 * Pack the appended scalar module parameters: speed-range normalizers for the
 * by-speed modules, rotation-by-speed angular velocity, orbital velocity and
 * offset, the speed-curve-enabled flag, and the noise field parameters.
 */
function writeParticleBurstModuleParamData(
  floats: Float32Array,
  blockBase: number,
  effect: ParticleEmitterEffectAsset,
): void {
  const runtime = effect.runtime;
  const base = blockBase + PARTICLE_BURST_MODULE_PARAM_FLOAT_OFFSET;

  floats[base] = runtime.sizeBySpeedRange.min;
  floats[base + 1] = runtime.sizeBySpeedRange.max;
  floats[base + 2] = runtime.colorBySpeedRange.min;
  floats[base + 3] = runtime.colorBySpeedRange.max;
  floats[base + 4] = runtime.rotationBySpeedRange.min;
  floats[base + 5] = runtime.rotationBySpeedRange.max;
  floats[base + 6] = runtime.angularVelocityBySpeed.min;
  floats[base + 7] = runtime.angularVelocityBySpeed.max;
  floats[base + 8] = runtime.orbitalVelocity[0];
  floats[base + 9] = runtime.orbitalVelocity[1];
  floats[base + 10] = runtime.orbitalVelocity[2];
  floats[base + 11] = runtime.radialVelocity;
  floats[base + 12] = runtime.orbitalOffset[0];
  floats[base + 13] = runtime.orbitalOffset[1];
  floats[base + 14] = runtime.orbitalOffset[2];
  floats[base + 15] = effect.speedOverLifetime.enabled ? 1 : 0;
  floats[base + 16] = runtime.noiseStrength;
  floats[base + 17] = runtime.noiseFrequency;
  floats[base + 18] = runtime.noiseScrollSpeed;
  floats[base + 19] = runtime.noiseDamping ? 1 : 0;
}

function writeParticleFrameData(
  floats: Float32Array,
  offset: number,
  options: {
    readonly effect: ParticleEmitterEffectAsset;
    readonly lifeT: number;
    readonly frameRandom: number;
    readonly rotation: number;
  },
): void {
  floats[offset] = options.effect.runtime.textureSheetTiles[0];
  floats[offset + 1] = options.effect.runtime.textureSheetTiles[1];
  floats[offset + 2] = particleAtlasFrameIndex(
    options.effect,
    options.lifeT,
    options.frameRandom,
  );
  floats[offset + 3] = options.rotation;
}

function particleAtlasFrameIndex(
  effect: ParticleEmitterEffectAsset,
  lifeT: number,
  frameRandom: number,
): number {
  const frameCount = Math.max(1, Math.trunc(effect.runtime.atlasFrameCount));

  if (frameCount <= 1) {
    return 0;
  }

  const frameMax = sampleRuntimeScalarCurve(
    effect.runtime.textureSheetFrameOverTime,
    lifeT,
  );
  const frameMin = sampleRuntimeScalarCurve(
    effect.runtime.textureSheetFrameOverTimeMin,
    lifeT,
  );
  const frameT = effect.runtime.textureSheetFrameOverTimeRandom
    ? lerp(frameMin, frameMax, clamp01(frameRandom))
    : frameMax;
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

function emitterWorldTransform(
  snapshot: RenderSnapshot,
  emitter: ParticleEmitterPacket,
): ArrayLike<number> {
  const offset = emitter.worldTransformOffset;

  return snapshot.transforms.subarray(offset, offset + 16);
}

function transformParticlePoint(
  matrix: ArrayLike<number>,
  point: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    (matrix[0] ?? 1) * point[0] +
      (matrix[4] ?? 0) * point[1] +
      (matrix[8] ?? 0) * point[2] +
      (matrix[12] ?? 0),
    (matrix[1] ?? 0) * point[0] +
      (matrix[5] ?? 1) * point[1] +
      (matrix[9] ?? 0) * point[2] +
      (matrix[13] ?? 0),
    (matrix[2] ?? 0) * point[0] +
      (matrix[6] ?? 0) * point[1] +
      (matrix[10] ?? 1) * point[2] +
      (matrix[14] ?? 0),
  ];
}

function transformParticleVector(
  matrix: ArrayLike<number>,
  vector: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    (matrix[0] ?? 1) * vector[0] +
      (matrix[4] ?? 0) * vector[1] +
      (matrix[8] ?? 0) * vector[2],
    (matrix[1] ?? 0) * vector[0] +
      (matrix[5] ?? 1) * vector[1] +
      (matrix[9] ?? 0) * vector[2],
    (matrix[2] ?? 0) * vector[0] +
      (matrix[6] ?? 0) * vector[1] +
      (matrix[10] ?? 1) * vector[2],
  ];
}

function particleTransformUniformScale(matrix: ArrayLike<number>): number {
  const scaleX = Math.hypot(matrix[0] ?? 1, matrix[1] ?? 0, matrix[2] ?? 0);
  const scaleY = Math.hypot(matrix[4] ?? 0, matrix[5] ?? 1, matrix[6] ?? 0);
  const scaleZ = Math.hypot(matrix[8] ?? 0, matrix[9] ?? 0, matrix[10] ?? 1);

  // Particle size is scalar in the packed renderer. Using the largest axis
  // preserves the authored extent under non-uniform transforms and is exact
  // for the overwhelmingly common uniform-scale case.
  return Math.max(scaleX, scaleY, scaleZ);
}

function cleanupParticleStates(
  cache: WebGpuAppResourceCache,
  activeKeys: Set<string>,
): number {
  let removed = 0;

  for (const key of cache.particleEmitterStates.keys()) {
    if (!activeKeys.has(key)) {
      retireParticleBuffer(
        cache,
        cache.particleEmitterStates.get(key)?.particleBuffer,
      );
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

      retireParticleBuffer(cache, state?.particleBuffer);
      retireParticleBuffer(cache, state?.paramBuffer);
      cache.particleBurstBatchStates.delete(key);
      removed += 1;
    }
  }

  return removed;
}

function retireParticleBuffer(
  cache: WebGpuAppResourceCache,
  buffer: unknown,
): void {
  if (buffer === undefined || buffer === null) {
    return;
  }

  cache.particleRetiredBuffers.buffers.push(buffer);
}

/**
 * Destroy particle buffers dropped from the caches this frame.
 *
 * A retired buffer can still be referenced by the previously submitted frame,
 * so destruction waits for that work — but the wait never blocks frame
 * assembly. Awaiting the queue fence inline serialized the renderer against
 * the GPU on every frame that dropped an emitter, which is every frame of live
 * gameplay (bursts retire, projectiles despawn), and the browser app skips
 * snapshots while a render is in flight: the fence therefore collapsed frame
 * production exactly when particle churn was highest. Retiring asynchronously
 * keeps the safety property (nothing is destroyed before the work that used it
 * completes) without holding the frame open.
 */
function retireStaleParticleBuffers(
  device: unknown,
  cache: WebGpuAppResourceCache,
): void {
  const retired = cache.particleRetiredBuffers.buffers;

  if (retired.length === 0) {
    return;
  }

  // Take ownership of exactly this frame's batch: a later frame's buffers were
  // used by a later submission and must wait for their own fence.
  const batch = retired.splice(0, retired.length);
  const queue = (
    device as {
      readonly queue?: {
        readonly onSubmittedWorkDone?: () => Promise<void>;
      };
    }
  ).queue;

  if (typeof queue?.onSubmittedWorkDone !== "function") {
    destroyParticleBuffers(batch);
    return;
  }

  const destroy = (): void => {
    destroyParticleBuffers(batch);
  };

  void queue.onSubmittedWorkDone.call(queue).then(destroy, destroy);
}

function destroyParticleBuffers(buffers: readonly unknown[]): void {
  for (const buffer of buffers) {
    destroyWebGpuBuffer(buffer);
  }
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
    simulatedEmitters: 0,
    liveParticles: 0,
    texturedEmitters: 0,
    batchGroups: 0,
    batchedEmitters: 0,
    drawCalls: 0,
    uploadedBytes: 0,
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
