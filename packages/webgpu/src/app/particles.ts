import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type PackedSnapshotViewUniforms,
  type ParticleEffectAsset,
  type ParticleEmitterPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { createCommandEncoderResource } from "../gpu/command-encoder.js";
import { finishCommandEncoder } from "../gpu/command-buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import {
  createSamplerGpuResource,
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type SamplerGpuResource,
  type TextureGpuResource,
} from "../resources/textures/texture-resources.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import { submitCommandBuffers } from "../render/queues/queue-submit.js";
import {
  executeComputePassCommands,
  type ComputePassEncoderLike,
} from "../render/passes/compute-pass-commands.js";
import {
  createParticleComputePipelineResource,
  createParticleRenderPipelineResource,
  particleComputePipelineCacheKey,
  particleRenderPipelineCacheKey,
  type CreateParticleComputePipelineResourceResult,
  type CreateParticleRenderPipelineResourceResult,
  type ParticleComputePipelineResource,
} from "../render/particles/particle-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
  type AppTextureSamplerResourceReuseReport,
} from "./app-texture-sampler-resources.js";
import type {
  ParticleEmitterCpuStateResource,
  ParticleEmitterGpuStateResource,
  WebGpuAppResourceCache,
} from "./resource-cache.js";
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
const PARTICLE_DATA_FLOAT_STRIDE = 8;
const PARTICLE_CURVE_SAMPLE_COUNT = 16;
const PARTICLE_SIZE_CURVE_FLOAT_OFFSET = 16;
const PARTICLE_COLOR_CURVE_FLOAT_OFFSET =
  PARTICLE_SIZE_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_PARAM_BYTE_LENGTH =
  16 +
  (PARTICLE_COLOR_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT * 4) * 4;
const PARTICLE_DEFAULT_TEXTURE_CACHE_KEY = "particle:default-white-texture";
const PARTICLE_DEFAULT_SAMPLER_CACHE_KEY = "particle:default-linear-sampler";

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
    const staleStatesRemoved = cleanupParticleStates(options.cache, new Set());
    const report = emptyParticleFrameReport();

    return {
      valid: true,
      commands: [],
      diagnostics: [],
      report: {
        ...report,
        staleStatesRemoved,
      },
    };
  }

  const computePipeline = await getOrCreateWebGpuAppParticleComputePipeline(
    options.app,
    options.cache,
  );

  if (!computePipeline.valid || computePipeline.resource === null) {
    return {
      valid: false,
      commands: [],
      diagnostics: [...computePipeline.diagnostics],
      report: emptyParticleFrameReport(emitters.length),
    };
  }

  return createParticleFrameResources({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: options.viewUniforms,
    computePipeline: computePipeline.resource,
    ...(options.reuse === undefined ? {} : { reuse: options.reuse }),
    time: options.time ?? 0,
  });
}

export async function getOrCreateWebGpuAppParticleComputePipeline(
  app: WebGpuAppParticleContext,
  cache: WebGpuAppResourceCache,
): Promise<CreateParticleComputePipelineResourceResult> {
  const key = particleComputePipelineCacheKey();
  const cached = cache.particleComputePipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createParticleComputePipelineResource({
    device: app.initialization.device as Parameters<
      typeof createParticleComputePipelineResource
    >[0]["device"],
  });

  cache.particleComputePipelines.set(key, result);
  return result;
}

export async function getOrCreateWebGpuAppParticleRenderPipeline(
  app: WebGpuAppParticleContext,
  cache: WebGpuAppResourceCache,
  blendMode: ParticleEffectAsset["blendMode"],
): Promise<CreateParticleRenderPipelineResourceResult> {
  const isHdr =
    app.sceneRenderFormat !== undefined &&
    app.sceneRenderFormat !== app.initialization.format;
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = particleRenderPipelineCacheKey(
    app.initialization.format,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
    blendMode,
    tonemap,
    outputColorSpace,
  );
  const cached = cache.particleRenderPipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createParticleRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createParticleRenderPipelineResource
    >[0]["device"],
    colorFormat: app.initialization.format,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: app.msaa.sampleCount,
    blendMode,
    tonemap,
    outputColorSpace,
  });

  cache.particleRenderPipelines.set(key, result);
  return result;
}

async function createParticleFrameResources(options: {
  readonly app: WebGpuAppParticleContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly computePipeline: ParticleComputePipelineResource;
  readonly reuse?: AppTextureSamplerResourceReuseReport;
  readonly time: number;
}): Promise<ParticleFrameResources> {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const report = emptyParticleFrameReport(
    options.snapshot.particleEmitters?.length ?? 0,
  );
  const mutableReport = report as MutableParticleFrameReport;
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
    readonly createCommandEncoder?: () => unknown;
    readonly queue?: {
      readonly submit?: (buffers: readonly unknown[]) => void;
    };
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  const computePipeline = options.computePipeline.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (
    device.createBindGroup === undefined ||
    computePipeline.getBindGroupLayout === undefined
  ) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "particleFrame.missingBindGroupSupport",
          message:
            "Particle frame resources require bind groups and pipeline layouts.",
        },
      ],
      report,
    };
  }

  const reuse = options.reuse ?? createParticleTextureSamplerReuseReport();
  const viewData = viewUniformData(options);
  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Particle/ViewUniforms",
      size: viewData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewData,
    },
  });

  if (!viewBuffer.ok) {
    return {
      valid: false,
      commands,
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

  for (const emitter of options.snapshot.particleEmitters ?? []) {
    const effectEntry = options.assets.get<
      "particle-effect",
      ParticleEffectAsset
    >(emitter.effect);
    const effect = effectEntry?.asset;

    if (
      effectEntry?.status !== "ready" ||
      effect === undefined ||
      effect === null
    ) {
      diagnostics.push({
        code: "particleFrame.effectNotReady",
        message: `Particle effect '${assetHandleKey(emitter.effect)}' is not ready.`,
      });
      continue;
    }

    const renderPipelineResult =
      await getOrCreateWebGpuAppParticleRenderPipeline(
        options.app,
        options.cache,
        effect.blendMode,
      );

    if (!renderPipelineResult.valid || renderPipelineResult.resource === null) {
      diagnostics.push(...renderPipelineResult.diagnostics);
      continue;
    }

    const renderPipelineResource = renderPipelineResult.resource;
    const renderPipeline = renderPipelineResource.pipeline as {
      readonly getBindGroupLayout?: (group: number) => unknown;
    };

    if (renderPipeline.getBindGroupLayout === undefined) {
      diagnostics.push({
        code: "particleFrame.missingBindGroupSupport",
        message: "Particle render pipeline does not expose bind-group layouts.",
      });
      continue;
    }

    const textureSampler = prepareParticleTextureSamplerResources({
      assets: options.assets,
      cache: options.cache,
      device,
      effect,
      reuse,
      diagnostics,
    });

    if (textureSampler === null) {
      continue;
    }

    if (effect.texture !== undefined && effect.texture !== null) {
      mutableReport.texturedEmitters += 1;
    }

    const stateResult = getOrCreateParticleEmitterGpuState({
      cache: options.cache,
      device,
      emitter,
    });

    if (!stateResult.valid || stateResult.state === null) {
      diagnostics.push(...stateResult.diagnostics);
      continue;
    }

    activeStateKeys.add(stateResult.state.key);
    mutableReport.statesCreated += stateResult.created ? 1 : 0;
    mutableReport.statesReused += stateResult.created ? 0 : 1;

    let drawInstanceCount = emitter.capacity;

    if (emitter.mode === "burst" && emitter.burst !== undefined) {
      const burstReport = updateParticleBurstCpuState({
        device,
        state: stateResult.state,
        emitter,
        effect,
        time: options.time,
      });

      diagnostics.push(...burstReport.diagnostics);
      drawInstanceCount = burstReport.liveParticles;
    } else {
      const params = createParticleParamData({
        emitter,
        effect,
        snapshot: options.snapshot,
        frame: options.snapshot.frame,
        time: options.time,
      });
      const paramBuffer = createWebGpuBuffer({
        device,
        descriptor: {
          label: `Particle/Params/${emitter.emitterId}`,
          size: params.byteLength,
          usage:
            WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM |
            WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
          initialData: params,
        },
      });

      if (!paramBuffer.ok) {
        diagnostics.push({
          code: "particleFrame.paramBufferFailed",
          message: paramBuffer.message,
        });
        continue;
      }

      const computeBindGroup = device.createBindGroup({
        label: `Particle/ComputeBindGroup/${emitter.emitterId}`,
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: paramBuffer.buffer } },
          {
            binding: 1,
            resource: { buffer: stateResult.state.particleBuffer },
          },
        ],
      });
      const computeReport = submitParticleComputePass({
        device,
        pipeline: options.computePipeline,
        bindGroup: computeBindGroup,
        emitter,
      });

      diagnostics.push(...computeReport.diagnostics);
      mutableReport.dispatches += computeReport.dispatches;
    }

    if (drawInstanceCount <= 0) {
      continue;
    }

    const viewBindGroup = device.createBindGroup({
      label: `Particle/ViewBindGroup/${emitter.emitterId}`,
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
    });
    mutableReport.liveParticles += drawInstanceCount;

    const particleBindGroup = device.createBindGroup({
      label: `Particle/RenderBindGroup/${emitter.emitterId}`,
      layout: renderPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: stateResult.state.particleBuffer } },
      ],
    });
    const textureBindGroup = device.createBindGroup({
      label: `Particle/TextureBindGroup/${emitter.emitterId}`,
      layout: renderPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: textureSampler.texture.view },
        { binding: 1, resource: textureSampler.sampler.sampler },
      ],
    });

    commands.push(
      {
        kind: "setPipeline",
        renderId: emitter.emitterId,
        pipelineKey: renderPipelineResource.cacheKey,
        pipeline: renderPipelineResource.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: emitter.emitterId,
        index: 0,
        resourceKey: `particle:view:${options.snapshot.frame}`,
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: emitter.emitterId,
        index: 1,
        resourceKey: stateResult.state.key,
        bindGroup: particleBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: emitter.emitterId,
        index: 2,
        resourceKey: `${textureSampler.textureKey}:${textureSampler.samplerKey}`,
        bindGroup: textureBindGroup,
      },
      {
        kind: "draw",
        renderId: emitter.emitterId,
        vertexCount: 6,
        instanceCount: drawInstanceCount,
        firstVertex: 0,
        firstInstance: 0,
      },
    );
  }

  mutableReport.textureResourcesCreated += reuse.textureResourcesCreated;
  mutableReport.textureResourcesReused += reuse.textureResourcesReused;
  mutableReport.samplerResourcesCreated += reuse.samplerResourcesCreated;
  mutableReport.samplerResourcesReused += reuse.samplerResourcesReused;
  mutableReport.staleStatesRemoved = cleanupParticleStates(
    options.cache,
    activeStateKeys,
  );

  return {
    valid: diagnostics.length === 0,
    commands,
    diagnostics,
    report,
  };
}

function prepareParticleTextureSamplerResources(options: {
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly device: unknown;
  readonly effect: ParticleEffectAsset;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: unknown[];
}): {
  readonly texture: TextureGpuResource;
  readonly sampler: SamplerGpuResource;
  readonly textureKey: string;
  readonly samplerKey: string;
} | null {
  const texture =
    options.effect.texture === undefined || options.effect.texture === null
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
          handle: options.effect.texture,
          reuse: options.reuse,
          diagnostics: options.diagnostics as Parameters<
            typeof prepareAppTextureResource
          >[0]["diagnostics"],
        });
  const sampler =
    options.effect.sampler === undefined || options.effect.sampler === null
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
          handle: options.effect.sampler,
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
    ...(options.emitter.mode === "burst"
      ? { cpu: createParticleEmitterCpuState(options.emitter.capacity) }
      : {}),
  };

  options.cache.particleEmitterStates.set(key, state);
  return { valid: true, state, created: true, diagnostics: [] };
}

function createParticleEmitterCpuState(
  capacity: number,
): ParticleEmitterCpuStateResource {
  return {
    positions: new Float32Array(capacity * 3),
    velocities: new Float32Array(capacity * 3),
    ages: new Float32Array(capacity),
    lifetimes: new Float32Array(capacity),
    baseSizes: new Float32Array(capacity),
    bufferData: new Float32Array(capacity * PARTICLE_DATA_FLOAT_STRIDE),
    initialized: false,
    lastTime: 0,
    liveCount: 0,
  };
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
  readonly effect: ParticleEffectAsset;
  readonly time: number;
}): {
  readonly liveParticles: number;
  readonly diagnostics: readonly unknown[];
} {
  const burst = options.emitter.burst;
  const cpu = options.state.cpu;

  if (burst === undefined || cpu === undefined) {
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

  if (!cpu.initialized) {
    initializeParticleBurstCpuState({
      cpu,
      emitter: options.emitter,
      effect: options.effect,
    });
    cpu.initialized = true;
    cpu.lastTime = options.time;
  }

  const rawDelta = options.time - cpu.lastTime;
  const delta =
    !Number.isFinite(rawDelta) || rawDelta <= 0
      ? 0
      : Math.min(rawDelta, 1 / 15) * options.emitter.timeScale;
  cpu.lastTime = options.time;

  const liveParticles = writeParticleBurstCpuBuffer({
    cpu,
    effect: options.effect,
    delta,
  });

  if (liveParticles > 0) {
    options.device.queue.writeBuffer(
      options.state.particleBuffer,
      0,
      cpu.bufferData.buffer,
      cpu.bufferData.byteOffset,
      liveParticles * PARTICLE_DATA_FLOAT_STRIDE * 4,
    );
  }

  return { liveParticles, diagnostics: [] };
}

function initializeParticleBurstCpuState(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEffectAsset;
}): void {
  const burst = options.emitter.burst;
  if (burst === undefined) {
    return;
  }

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
    options.cpu.velocities[offset] = lerp(
      burst.velocityMin[0],
      burst.velocityMax[0],
      r2,
    );
    options.cpu.velocities[offset + 1] = lerp(
      burst.velocityMin[1],
      burst.velocityMax[1],
      r3,
    );
    options.cpu.velocities[offset + 2] = lerp(
      burst.velocityMin[2],
      burst.velocityMax[2],
      r4,
    );
    options.cpu.ages[index] = 0;
    options.cpu.lifetimes[index] = Math.max(
      0.001,
      lerp(options.effect.lifetime.min, options.effect.lifetime.max, r3),
    );
    options.cpu.baseSizes[index] = Math.max(
      0.001,
      lerp(options.effect.startSize.min, options.effect.startSize.max, r4),
    );
  }
}

function writeParticleBurstCpuBuffer(options: {
  readonly cpu: ParticleEmitterCpuStateResource;
  readonly effect: ParticleEffectAsset;
  readonly delta: number;
}): number {
  let live = 0;

  for (let index = 0; index < options.cpu.ages.length; index += 1) {
    const lifetime = options.cpu.lifetimes[index] ?? 0;
    const age = (options.cpu.ages[index] ?? 0) + options.delta;

    if (age >= lifetime) {
      options.cpu.ages[index] = lifetime;
      continue;
    }

    options.cpu.ages[index] = age;
    const sourceOffset = index * 3;
    options.cpu.velocities[sourceOffset] =
      (options.cpu.velocities[sourceOffset] ?? 0) +
      options.effect.gravity[0] * options.delta;
    options.cpu.velocities[sourceOffset + 1] =
      (options.cpu.velocities[sourceOffset + 1] ?? 0) +
      options.effect.gravity[1] * options.delta;
    options.cpu.velocities[sourceOffset + 2] =
      (options.cpu.velocities[sourceOffset + 2] ?? 0) +
      options.effect.gravity[2] * options.delta;
    options.cpu.positions[sourceOffset] =
      (options.cpu.positions[sourceOffset] ?? 0) +
      (options.cpu.velocities[sourceOffset] ?? 0) * options.delta;
    options.cpu.positions[sourceOffset + 1] =
      (options.cpu.positions[sourceOffset + 1] ?? 0) +
      (options.cpu.velocities[sourceOffset + 1] ?? 0) * options.delta;
    options.cpu.positions[sourceOffset + 2] =
      (options.cpu.positions[sourceOffset + 2] ?? 0) +
      (options.cpu.velocities[sourceOffset + 2] ?? 0) * options.delta;

    const lifeT = clamp01(age / lifetime);
    const color = samplePackedParticleColorCurve(options.effect, lifeT);
    const outputOffset = live * PARTICLE_DATA_FLOAT_STRIDE;

    options.cpu.bufferData[outputOffset] =
      options.cpu.positions[sourceOffset] ?? 0;
    options.cpu.bufferData[outputOffset + 1] =
      options.cpu.positions[sourceOffset + 1] ?? 0;
    options.cpu.bufferData[outputOffset + 2] =
      options.cpu.positions[sourceOffset + 2] ?? 0;
    options.cpu.bufferData[outputOffset + 3] = Math.max(
      0.001,
      (options.cpu.baseSizes[index] ?? 1) *
        samplePackedParticleSizeCurve(options.effect, lifeT),
    );
    options.cpu.bufferData[outputOffset + 4] = color[0];
    options.cpu.bufferData[outputOffset + 5] = color[1];
    options.cpu.bufferData[outputOffset + 6] = color[2];
    options.cpu.bufferData[outputOffset + 7] = color[3];
    live += 1;
  }

  options.cpu.liveCount = live;
  return live;
}

function hashUnit(value: number): number {
  let x = value >>> 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
  x = ((x >>> 16) ^ x) >>> 0;
  return (x & 0x00ff_ffff) / 0x0100_0000;
}

function submitParticleComputePass(options: {
  readonly device: {
    readonly createCommandEncoder?: () => unknown;
    readonly queue?: {
      readonly submit?: (buffers: readonly unknown[]) => void;
    };
  };
  readonly pipeline: ParticleComputePipelineResource;
  readonly bindGroup: unknown;
  readonly emitter: ParticleEmitterPacket;
}): { readonly dispatches: number; readonly diagnostics: readonly unknown[] } {
  const encoderResult = createCommandEncoderResource({
    device: options.device,
    label: `particle-compute:${options.emitter.emitterId}`,
  });
  const encoder = encoderResult.resource?.encoder as
    | {
        beginComputePass?: (descriptor?: unknown) => ComputePassEncoderLike & {
          end?: () => void;
        };
        finish?: () => unknown;
      }
    | undefined;
  const pass = encoder?.beginComputePass?.({
    label: `ParticleCompute/${options.emitter.emitterId}`,
  });

  if (!encoderResult.valid || encoder === undefined || pass === undefined) {
    return {
      dispatches: 0,
      diagnostics: [
        ...encoderResult.diagnostics,
        {
          code: "particleFrame.beginComputeFailed",
          message: "Particle compute pass could not begin.",
        },
      ],
    };
  }

  const execution = executeComputePassCommands({
    pass,
    commands: [
      {
        kind: "setComputePipeline",
        pipelineKey: options.pipeline.cacheKey,
        pipeline: options.pipeline.pipeline,
      },
      {
        kind: "setComputeBindGroup",
        index: 0,
        resourceKey: particleEmitterStateKey(options.emitter),
        bindGroup: options.bindGroup,
      },
      {
        kind: "dispatchWorkgroups",
        workgroupCountX: Math.max(1, Math.ceil(options.emitter.capacity / 64)),
        workgroupCountY: 1,
        workgroupCountZ: 1,
      },
    ],
  });

  pass.end?.();
  const finished = finishCommandEncoder({
    encoder,
    label: `particle-compute:${options.emitter.emitterId}`,
  });
  const submitted =
    finished.resource === null
      ? null
      : submitCommandBuffers({
          queue: options.device.queue ?? {},
          commandBuffers: [finished.resource],
        });

  return {
    dispatches: execution.dispatchCount,
    diagnostics: [
      ...execution.diagnostics,
      ...finished.diagnostics,
      ...(submitted?.diagnostics ?? []),
    ],
  };
}

function createParticleParamData(options: {
  readonly emitter: ParticleEmitterPacket;
  readonly effect: ParticleEffectAsset;
  readonly snapshot: RenderSnapshot;
  readonly frame: number;
  readonly time: number;
}): Uint8Array {
  const bytes = new Uint8Array(PARTICLE_PARAM_BYTE_LENGTH);
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, 4);
  const floats = new Float32Array(
    bytes.buffer,
    bytes.byteOffset + 16,
    (PARTICLE_PARAM_BYTE_LENGTH - 16) / 4,
  );
  const startColor = options.effect.startColor;
  const endColor = options.effect.endColor;
  const origin = emitterWorldOrigin(options.snapshot, options.emitter);

  words[0] = options.frame >>> 0;
  words[1] = options.emitter.seed >>> 0;
  words[2] = options.emitter.capacity >>> 0;
  words[3] = PARTICLE_CURVE_SAMPLE_COUNT;
  floats[0] = origin[0];
  floats[1] = origin[1];
  floats[2] = options.time * options.emitter.timeScale;
  floats[3] = Math.max(0.01, options.effect.startSpeed.max);
  floats[4] = startColor[0];
  floats[5] = startColor[1];
  floats[6] = startColor[2];
  floats[7] = startColor[3];
  floats[8] = endColor[0];
  floats[9] = endColor[1];
  floats[10] = endColor[2];
  floats[11] = endColor[3];
  floats[12] = options.effect.startSize.min;
  floats[13] = options.effect.startSize.max;
  floats[14] = options.effect.lifetime.max;
  floats[15] = 0;
  writeParticleCurveData(floats, options.effect);

  return bytes;
}

function writeParticleCurveData(
  floats: Float32Array,
  effect: ParticleEffectAsset,
): void {
  for (let index = 0; index < PARTICLE_CURVE_SAMPLE_COUNT; index += 1) {
    const t = index / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
    const color = samplePackedParticleColorCurve(effect, t);

    floats[PARTICLE_SIZE_CURVE_FLOAT_OFFSET + index] =
      samplePackedParticleSizeCurve(effect, t);
    floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4] = color[0];
    floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 1] = color[1];
    floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 2] = color[2];
    floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 3] = color[3];
  }
}

function samplePackedParticleSizeCurve(
  effect: ParticleEffectAsset,
  t: number,
): number {
  return samplePackedScalarTable(effect.curves.sizeOverLifetime, t);
}

function samplePackedParticleColorCurve(
  effect: ParticleEffectAsset,
  t: number,
): readonly [number, number, number, number] {
  const color = effect.curves.colorOverLifetime;
  const sampleCount = effect.curves.sampleCount;

  if (sampleCount <= 1) {
    return [
      color[0] ?? effect.startColor[0],
      color[1] ?? effect.startColor[1],
      color[2] ?? effect.startColor[2],
      color[3] ?? effect.startColor[3],
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
      color[lowerOffset] ?? effect.startColor[0],
      color[upperOffset] ?? effect.endColor[0],
      blend,
    ),
    lerp(
      color[lowerOffset + 1] ?? effect.startColor[1],
      color[upperOffset + 1] ?? effect.endColor[1],
      blend,
    ),
    lerp(
      color[lowerOffset + 2] ?? effect.startColor[2],
      color[upperOffset + 2] ?? effect.endColor[2],
      blend,
    ),
    lerp(
      color[lowerOffset + 3] ?? effect.startColor[3],
      color[upperOffset + 3] ?? effect.endColor[3],
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
      cache.particleEmitterStates.delete(key);
      removed += 1;
    }
  }

  return removed;
}

function emptyParticleFrameReport(emitters = 0): ParticleFrameReport {
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

type MutableParticleFrameReport = {
  -readonly [Key in keyof ParticleFrameReport]: ParticleFrameReport[Key];
};
