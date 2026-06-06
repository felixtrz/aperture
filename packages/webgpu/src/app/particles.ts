import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
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
  type ParticleRenderPipelineResource,
} from "../render/particles/particle-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type {
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
  readonly statesCreated: number;
  readonly statesReused: number;
  readonly staleStatesRemoved: number;
  readonly dispatches: number;
}

const PARTICLE_VIEWPORT_FLOAT_OFFSET = 20;
const PARTICLE_DATA_FLOAT_STRIDE = 8;
const PARTICLE_PARAM_BYTE_LENGTH = 80;

export async function prepareParticleFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppParticleContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
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
  const renderPipeline = await getOrCreateWebGpuAppParticleRenderPipeline(
    options.app,
    options.cache,
  );

  if (
    !computePipeline.valid ||
    computePipeline.resource === null ||
    !renderPipeline.valid ||
    renderPipeline.resource === null
  ) {
    return {
      valid: false,
      commands: [],
      diagnostics: [
        ...computePipeline.diagnostics,
        ...renderPipeline.diagnostics,
      ],
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
    renderPipeline: renderPipeline.resource,
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
): Promise<CreateParticleRenderPipelineResourceResult> {
  const key = particleRenderPipelineCacheKey(
    app.initialization.format,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
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
  });

  cache.particleRenderPipelines.set(key, result);
  return result;
}

function createParticleFrameResources(options: {
  readonly app: WebGpuAppParticleContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly computePipeline: ParticleComputePipelineResource;
  readonly renderPipeline: ParticleRenderPipelineResource;
  readonly time: number;
}): ParticleFrameResources {
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
  const renderPipeline = options.renderPipeline.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (
    device.createBindGroup === undefined ||
    computePipeline.getBindGroupLayout === undefined ||
    renderPipeline.getBindGroupLayout === undefined
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

  const viewBindGroup = device.createBindGroup({
    label: "Particle/ViewBindGroup",
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });
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
        { binding: 1, resource: { buffer: stateResult.state.particleBuffer } },
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
    mutableReport.liveParticles += emitter.capacity;

    const particleBindGroup = device.createBindGroup({
      label: `Particle/RenderBindGroup/${emitter.emitterId}`,
      layout: renderPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: stateResult.state.particleBuffer } },
      ],
    });

    commands.push(
      {
        kind: "setPipeline",
        renderId: emitter.emitterId,
        pipelineKey: options.renderPipeline.cacheKey,
        pipeline: options.renderPipeline.pipeline,
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
        kind: "draw",
        renderId: emitter.emitterId,
        vertexCount: 6,
        instanceCount: emitter.capacity,
        firstVertex: 0,
        firstInstance: 0,
      },
    );
  }

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
  };

  options.cache.particleEmitterStates.set(key, state);
  return { valid: true, state, created: true, diagnostics: [] };
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
  words[3] = 0;
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

  return bytes;
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
    statesCreated: 0,
    statesReused: 0,
    staleStatesRemoved: 0,
    dispatches: 0,
  };
}

type MutableParticleFrameReport = {
  -readonly [Key in keyof ParticleFrameReport]: ParticleFrameReport[Key];
};
