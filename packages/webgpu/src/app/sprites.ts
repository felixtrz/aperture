import { type AssetRegistry } from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  encodeQuadInstanceFlags,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type QuadBatchPacket,
  type QuadDepthMode,
  type RenderSnapshot,
  type SpriteDrawPacket,
} from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import {
  createSamplerGpuResource,
  type SamplerGpuResource,
} from "../resources/textures/texture-resources.js";
import {
  createSpriteRenderPipelineResource,
  spritePipelineCacheKey,
  type CreateSpriteRenderPipelineResourceResult,
  type SpriteRenderPipelineResource,
} from "../render/sprites/sprite-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
} from "./app-texture-sampler-resources.js";
import {
  webGpuAppScenePassColorFormat,
  webGpuAppUsesHdrScenePass,
} from "./render-color-format.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";

interface WebGpuAppSpriteContext {
  readonly canvas?: WebGpuCanvasLike;
  readonly initialization: {
    readonly device: unknown;
    readonly format: string;
  };
  readonly msaa: {
    readonly sampleCount: number;
  };
  // AI-17: output-stage config (the full app supplies these). Optional so minimal
  // sprite contexts still build a byte-identical (no-op) pipeline.
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly sceneRenderFormat?: string;
}

export interface SpriteFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
}

interface PreparedSpriteFrameResources {
  readonly pipeline: CreateSpriteRenderPipelineResourceResult | null;
  readonly resources: SpriteFrameResources;
}

interface SpriteRenderBatch {
  readonly renderId: number;
  readonly texture: SpriteDrawPacket["texture"];
  readonly sampler?: SpriteDrawPacket["sampler"];
  readonly depthMode: QuadDepthMode;
  readonly firstInstance: number;
  readonly instanceCount: number;
}

const SPRITE_VIEWPORT_FLOAT_OFFSET = 20;

export async function prepareSpriteFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppSpriteContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<PreparedSpriteFrameResources> {
  const spriteDraws = options.snapshot.spriteDraws ?? [];
  const quadSpriteBatches = spriteQuadBatches(options.snapshot);

  if (spriteDraws.length === 0 && quadSpriteBatches.length === 0) {
    return {
      pipeline: null,
      resources: {
        valid: true,
        commands: [],
        diagnostics: [],
      },
    };
  }

  const pipelineResults = new Map<
    QuadDepthMode,
    CreateSpriteRenderPipelineResourceResult
  >();

  for (const depthMode of spriteDepthModesForSnapshot(
    options.snapshot,
    spriteDraws,
  )) {
    pipelineResults.set(
      depthMode,
      await getOrCreateWebGpuAppSpritePipeline(
        options.app,
        options.cache,
        depthMode,
      ),
    );
  }

  const pipeline = pipelineResults.values().next().value ?? null;
  const invalidPipelines = Array.from(pipelineResults.values()).filter(
    (candidate) => !candidate.valid || candidate.resource === null,
  );

  if (pipeline === null || invalidPipelines.length > 0) {
    return {
      pipeline,
      resources: {
        valid: false,
        commands: [],
        diagnostics: invalidPipelines.flatMap(
          (candidate) => candidate.diagnostics,
        ),
      },
    };
  }

  const primaryPipelineResource = pipeline.resource;

  if (primaryPipelineResource === null) {
    return {
      pipeline,
      resources: {
        valid: false,
        commands: [],
        diagnostics: pipeline.diagnostics,
      },
    };
  }

  const pipelineResourcesByDepthMode = new Map<
    QuadDepthMode,
    SpriteRenderPipelineResource
  >();

  for (const [depthMode, result] of pipelineResults) {
    if (result.resource !== null) {
      pipelineResourcesByDepthMode.set(depthMode, result.resource);
    }
  }

  return {
    pipeline,
    resources: createSpriteFrameResources({
      app: options.app,
      assets: options.assets,
      cache: options.cache,
      snapshot: options.snapshot,
      spriteDraws,
      viewUniforms: options.viewUniforms,
      worldTransforms: options.worldTransforms,
      pipeline: primaryPipelineResource,
      pipelinesByDepthMode: pipelineResourcesByDepthMode,
      reuse: options.reuse,
    }),
  };
}

export function createSpriteFrameResources(options: {
  readonly app: WebGpuAppSpriteContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly spriteDraws: readonly SpriteDrawPacket[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly pipeline: SpriteRenderPipelineResource;
  readonly pipelinesByDepthMode?: ReadonlyMap<
    QuadDepthMode,
    SpriteRenderPipelineResource
  >;
  readonly reuse: WebGpuAppResourceReuseReport;
}): SpriteFrameResources {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  const packedViewUniformData = options.viewUniforms.data.subarray(
    0,
    options.viewUniforms.floatCount ?? options.viewUniforms.data.length,
  );
  const viewUniformData = createSpriteViewUniformData({
    snapshot: options.snapshot,
    viewUniforms: options.viewUniforms,
    source: packedViewUniformData,
    ...(options.app.canvas === undefined ? {} : { canvas: options.app.canvas }),
  });
  const worldTransformData = options.worldTransforms.data.subarray(
    0,
    options.worldTransforms.floatCount ?? options.worldTransforms.data.length,
  );

  if (device.createBindGroup === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "spriteFrame.createBindGroupUnavailable",
          message: "WebGPU device cannot create sprite bind groups.",
        },
      ],
    };
  }

  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/ViewUniforms",
      size: viewUniformData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewUniformData,
    },
  });
  const transformBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/WorldTransforms",
      size: worldTransformData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: worldTransformData,
    },
  });
  const spriteRenderInput = createSpriteRenderInput(
    options.snapshot,
    options.spriteDraws,
    diagnostics,
  );
  const spriteBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/Data",
      size: spriteRenderInput.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: spriteRenderInput.data,
    },
  });

  if (!viewBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic("spriteFrame.viewBufferFailed", viewBuffer.message),
    );
  }

  if (!transformBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic(
        "spriteFrame.transformBufferFailed",
        transformBuffer.message,
      ),
    );
  }

  if (!spriteBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic("spriteFrame.spriteBufferFailed", spriteBuffer.message),
    );
  }

  if (!viewBuffer.ok || !transformBuffer.ok || !spriteBuffer.ok) {
    return { valid: false, commands, diagnostics };
  }

  const defaultSampler = getOrCreateSpriteDefaultSampler(
    options.app,
    options.cache,
    options.reuse,
    diagnostics,
  );

  if (defaultSampler === null) {
    return { valid: false, commands, diagnostics };
  }

  const viewBindGroups = new Map<string, unknown>();
  const transformBindGroups = new Map<string, unknown>();

  for (const draw of spriteRenderInput.batches) {
    const renderPipeline =
      options.pipelinesByDepthMode?.get(draw.depthMode) ?? options.pipeline;
    const pipeline = renderPipeline.pipeline as {
      readonly getBindGroupLayout?: (group: number) => unknown;
    };

    if (pipeline.getBindGroupLayout === undefined) {
      diagnostics.push({
        code: "spriteFrame.missingPipelineLayouts",
        message: "Sprite pipeline does not expose bind group layouts.",
      });
      continue;
    }

    const viewBindGroup =
      viewBindGroups.get(renderPipeline.cacheKey) ??
      device.createBindGroup({
        label: `Sprite/ViewBindGroup/${renderPipeline.cacheKey}`,
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
      });
    viewBindGroups.set(renderPipeline.cacheKey, viewBindGroup);

    const transformBindGroup =
      transformBindGroups.get(renderPipeline.cacheKey) ??
      device.createBindGroup({
        label: `Sprite/TransformBindGroup/${renderPipeline.cacheKey}`,
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: transformBuffer.buffer } }],
      });
    transformBindGroups.set(renderPipeline.cacheKey, transformBindGroup);

    const sampler =
      draw.sampler === undefined || draw.sampler === null
        ? {
            cacheKey: "sprite:default-sampler",
            resource: defaultSampler,
          }
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: draw.sampler,
            reuse: options.reuse,
            diagnostics: diagnostics as Parameters<
              typeof prepareAppSamplerResource
            >[0]["diagnostics"],
          });

    if (sampler === null) {
      continue;
    }

    const texture = prepareAppTextureResource({
      assets: options.assets,
      device: options.app.initialization.device,
      cache: options.cache,
      handle: draw.texture,
      reuse: options.reuse,
      diagnostics: diagnostics as Parameters<
        typeof prepareAppTextureResource
      >[0]["diagnostics"],
    });

    if (texture === null) {
      continue;
    }

    const spriteBindGroup = device.createBindGroup({
      label: `Sprite/TextureBindGroup/${draw.renderId}`,
      layout: pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: spriteBuffer.buffer } },
        { binding: 1, resource: texture.resource.view },
        { binding: 2, resource: sampler.resource.sampler },
      ],
    });

    commands.push(
      {
        kind: "setPipeline",
        renderId: draw.renderId,
        pipelineKey: renderPipeline.cacheKey,
        pipeline: renderPipeline.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: 0,
        resourceKey: "sprite:view",
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: 1,
        resourceKey: "sprite:transforms",
        bindGroup: transformBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: 2,
        resourceKey: `sprite:${texture.cacheKey}:${sampler.cacheKey}`,
        bindGroup: spriteBindGroup,
      },
      {
        kind: "draw",
        renderId: draw.renderId,
        vertexCount: 6,
        instanceCount: draw.instanceCount,
        firstVertex: 0,
        firstInstance: draw.firstInstance,
      },
    );
  }

  return {
    valid: diagnostics.length === 0 && commands.length > 0,
    commands,
    diagnostics,
  };
}

export async function getOrCreateWebGpuAppSpritePipeline(
  app: WebGpuAppSpriteContext,
  cache: WebGpuAppResourceCache,
  depthMode: QuadDepthMode = "test",
): Promise<CreateSpriteRenderPipelineResourceResult> {
  // On the HDR scene-buffer path the sprite renders into rgba16float and the post
  // stage encodes; otherwise the sprite encodes in-material via the output stage.
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = spritePipelineCacheKey(
    colorFormat,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
    depthMode,
  );
  const cached = cache.spritePipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createSpriteRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createSpriteRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    depthMode,
    sampleCount: app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  });

  cache.spritePipelines.set(key, result);
  return result;
}

function createSpriteRenderInput(
  snapshot: RenderSnapshot,
  spriteDraws: readonly SpriteDrawPacket[],
  diagnostics: unknown[],
): {
  readonly data: Float32Array;
  readonly batches: readonly SpriteRenderBatch[];
} {
  const quadSpriteBatches = spriteQuadBatches(snapshot);

  if (snapshot.quads !== undefined && quadSpriteBatches.length > 0) {
    const batches: SpriteRenderBatch[] = [];

    for (const batch of quadSpriteBatches) {
      if (batch.texture === undefined || batch.texture === null) {
        diagnostics.push({
          code: "spriteFrame.quadBatchMissingTexture",
          message: `Sprite quad batch ${batch.batchId} is missing its texture handle.`,
        });
        continue;
      }

      batches.push({
        renderId: batch.batchId,
        texture: batch.texture,
        ...(batch.sampler === undefined ? {} : { sampler: batch.sampler }),
        depthMode: batch.depthMode ?? "test",
        firstInstance: batch.firstInstance,
        instanceCount: batch.instanceCount,
      });
    }

    return {
      data: packQuadSpriteData(snapshot),
      batches,
    };
  }

  return packLegacySpriteData(snapshot, spriteDraws);
}

function createSpriteViewUniformData(options: {
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly source: Float32Array;
  readonly canvas?: WebGpuCanvasLike;
}): Float32Array {
  const data = new Float32Array(options.source);
  const dimensions =
    options.canvas === undefined
      ? { width: 1, height: 1 }
      : webGpuAppCanvasDimensions(options.canvas);

  // The sprite shader only reads view-projection, camera position, and this
  // sprite-specific viewport vec4. It intentionally replaces the temporal matrix
  // lanes from the shared packed-view record in this buffer only.
  for (const record of options.viewUniforms.views) {
    const view = options.snapshot.views.find(
      (candidate) => candidate.viewId === record.viewId,
    );
    const viewport = view?.viewport ?? [0, 0, 1, 1];
    const offset = record.packedOffset + SPRITE_VIEWPORT_FLOAT_OFFSET;

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

function packLegacySpriteData(
  snapshot: RenderSnapshot,
  spriteDraws: readonly SpriteDrawPacket[],
): {
  readonly data: Float32Array;
  readonly batches: readonly SpriteRenderBatch[];
} {
  const transformCount = Math.max(
    1,
    Math.ceil(snapshot.transforms.length / 16),
  );
  const data = new Float32Array(transformCount * 16);
  const batches: SpriteRenderBatch[] = [];
  const defaultFlags = encodeQuadInstanceFlags({
    coordinateMode: "world",
    billboardMode: "spherical",
    sizeMode: "world-units",
  });

  for (const draw of spriteDraws) {
    const index = Math.floor(draw.worldTransformOffset / 16);
    const offset = index * 16;

    data.set(draw.color, offset);
    data[offset + 4] = draw.width;
    data[offset + 5] = draw.height;
    data[offset + 6] = 0.5;
    data[offset + 7] = 0.5;
    data[offset + 8] = 0;
    data[offset + 9] = 0;
    data[offset + 10] = 1;
    data[offset + 11] = 1;
    data[offset + 12] = defaultFlags;
    data[offset + 13] = 0;
    data[offset + 14] = index;
    data[offset + 15] = 0;
    batches.push({
      renderId: draw.renderId,
      texture: draw.texture,
      ...(draw.sampler === undefined ? {} : { sampler: draw.sampler }),
      depthMode: draw.depthMode ?? "test",
      firstInstance: index,
      instanceCount: 1,
    });
  }

  return { data, batches };
}

function packQuadSpriteData(snapshot: RenderSnapshot): Float32Array {
  const quads = snapshot.quads;

  if (quads === undefined) {
    return new Float32Array(0);
  }

  const instanceCount = quads.instanceFloats.length / quads.instanceFloatStride;
  const data = new Float32Array(instanceCount * 16);

  for (let instance = 0; instance < instanceCount; instance += 1) {
    const sourceFloat = instance * quads.instanceFloatStride;
    const sourceWord = instance * quads.instanceWordStride;
    const target = instance * 16;

    data[target] = quads.instanceFloats[sourceFloat + 13] ?? 1;
    data[target + 1] = quads.instanceFloats[sourceFloat + 14] ?? 1;
    data[target + 2] = quads.instanceFloats[sourceFloat + 15] ?? 1;
    data[target + 3] = quads.instanceFloats[sourceFloat + 16] ?? 1;
    data[target + 4] = quads.instanceFloats[sourceFloat + 4] ?? 1;
    data[target + 5] = quads.instanceFloats[sourceFloat + 5] ?? 1;
    data[target + 6] = quads.instanceFloats[sourceFloat + 7] ?? 0.5;
    data[target + 7] = quads.instanceFloats[sourceFloat + 8] ?? 0.5;
    data[target + 8] = quads.instanceFloats[sourceFloat + 9] ?? 0;
    data[target + 9] = quads.instanceFloats[sourceFloat + 10] ?? 0;
    data[target + 10] = quads.instanceFloats[sourceFloat + 11] ?? 1;
    data[target + 11] = quads.instanceFloats[sourceFloat + 12] ?? 1;
    data[target + 12] = quads.instanceWords[sourceWord + 3] ?? 0;
    data[target + 13] = quads.instanceWords[sourceWord + 2] ?? 0;
    data[target + 14] = (quads.instanceWords[sourceWord] ?? 0) / 16;
    data[target + 15] = quads.instanceFloats[sourceFloat + 6] ?? 0;
  }

  return data;
}

function spriteQuadBatches(
  snapshot: RenderSnapshot,
): readonly QuadBatchPacket[] {
  return (snapshot.quadBatches ?? []).filter(
    (batch) => batch.kind === "sprite",
  );
}

function spriteDepthModesForSnapshot(
  snapshot: RenderSnapshot,
  spriteDraws: readonly SpriteDrawPacket[],
): ReadonlySet<QuadDepthMode> {
  const modes = new Set<QuadDepthMode>();

  for (const batch of spriteQuadBatches(snapshot)) {
    modes.add(batch.depthMode ?? "test");
  }

  for (const draw of spriteDraws) {
    modes.add(draw.depthMode ?? "test");
  }

  return modes;
}

function getOrCreateSpriteDefaultSampler(
  app: WebGpuAppSpriteContext,
  cache: WebGpuAppResourceCache,
  reuse: WebGpuAppResourceReuseReport,
  diagnostics: unknown[],
): SamplerGpuResource | null {
  const cacheKey = "sprite:default-sampler";
  const cached = cache.samplers.get(cacheKey);

  if (cached !== undefined) {
    reuse.samplerResourcesReused += 1;
    return cached;
  }

  const sampler = createSamplerGpuResource({
    device: app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey: cacheKey,
    sampler: createSamplerAsset({
      label: "SpriteDefaultSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  diagnostics.push(...sampler.diagnostics);

  if (!sampler.valid || sampler.resource === null) {
    return null;
  }

  cache.samplers.set(cacheKey, sampler.resource);
  reuse.samplerResourcesCreated += 1;
  return sampler.resource;
}

function bufferDiagnostic(code: string, message: string): unknown {
  return { code, message };
}
