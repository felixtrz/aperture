import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type DecalPacket,
  type DecalSnapshotReport,
  type PackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import {
  createSamplerGpuResource,
  type SamplerGpuResource,
} from "../resources/textures/texture-resources.js";
import {
  createDecalRenderPipelineResource,
  decalPipelineCacheKey,
  type CreateDecalRenderPipelineResourceResult,
  type DecalRenderPipelineResource,
} from "../render/decals/decal-pipeline.js";
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

interface WebGpuAppDecalContext {
  readonly canvas?: WebGpuCanvasLike;
  readonly initialization: {
    readonly device: unknown;
    readonly format: string;
  };
  readonly msaa: {
    readonly sampleCount: number;
  };
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly sceneRenderFormat?: string;
}

export interface DecalFrameReport {
  /** Live-decal pool cap this frame (max authored `capacity`). */
  readonly capacity: number;
  /** Decals kept after the oldest-first cap (== rendered instances). */
  readonly live: number;
  /** Decals evicted by the cap this frame. */
  readonly evicted: number;
  /** Live decal entities gathered at extraction before the cap. */
  readonly submitted: number;
  /** Decal instances actually drawn (== live when all textures resolved). */
  readonly drawn: number;
  /** Contiguous same-texture draw batches emitted. */
  readonly textureBatches: number;
}

export interface DecalFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
  readonly report?: DecalFrameReport;
}

const DECAL_INSTANCE_FLOAT_STRIDE = 28;
const DECAL_DEFAULT_SAMPLER_CACHE_KEY = "decal:default-linear-sampler";

interface DecalTextureBatch {
  readonly textureHandle: DecalPacket["texture"];
  readonly sampler: DecalPacket["sampler"];
  readonly firstInstance: number;
  readonly instanceCount: number;
}

export async function prepareDecalFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppDecalContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<DecalFrameResources> {
  const decals = options.snapshot.decals ?? [];

  // Byte-identity: a frame with no decals submits no decal pass, builds no
  // pipeline, and returns no report — indistinguishable from a pre-D4 frame.
  if (decals.length === 0) {
    return { valid: true, commands: [], diagnostics: [] };
  }

  const snapshotReport = options.snapshot.report.decals;
  const pipelineResult = await getOrCreateWebGpuAppDecalPipeline(
    options.app,
    options.cache,
  );

  if (!pipelineResult.valid || pipelineResult.resource === null) {
    return {
      valid: false,
      commands: [],
      diagnostics: pipelineResult.diagnostics,
      report: baseDecalReport(decals, snapshotReport, 0, 0),
    };
  }

  return createDecalFrameResources({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    decals,
    snapshotReport,
    viewUniforms: options.viewUniforms,
    pipeline: pipelineResult.resource,
    reuse: options.reuse,
  });
}

function createDecalFrameResources(options: {
  readonly app: WebGpuAppDecalContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly decals: readonly DecalPacket[];
  readonly snapshotReport: DecalSnapshotReport | undefined;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly pipeline: DecalRenderPipelineResource;
  readonly reuse: WebGpuAppResourceReuseReport;
}): DecalFrameResources {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];

  if (device.createBindGroup === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "decalFrame.createBindGroupUnavailable",
          message: "WebGPU device cannot create decal bind groups.",
        },
      ],
      report: baseDecalReport(options.decals, options.snapshotReport, 0, 0),
    };
  }

  const viewData = decalViewUniformData(options.viewUniforms);

  if (viewData === null) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "decalFrame.missingView",
          message: "Decal rendering requires at least one view uniform record.",
        },
      ],
      report: baseDecalReport(options.decals, options.snapshotReport, 0, 0),
    };
  }

  const instanceData = packDecalInstances(options.snapshot, options.decals);
  const batches = decalTextureBatches(options.decals);

  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Decal/ViewUniforms",
      size: viewData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewData,
    },
  });
  const instanceBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Decal/Instances",
      size: instanceData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: instanceData,
    },
  });

  if (!viewBuffer.ok) {
    diagnostics.push({
      code: "decalFrame.viewBufferFailed",
      message: viewBuffer.message,
    });
  }

  if (!instanceBuffer.ok) {
    diagnostics.push({
      code: "decalFrame.instanceBufferFailed",
      message: instanceBuffer.message,
    });
  }

  if (!viewBuffer.ok || !instanceBuffer.ok) {
    return {
      valid: false,
      commands,
      diagnostics,
      report: baseDecalReport(options.decals, options.snapshotReport, 0, 0),
    };
  }

  const defaultSampler = getOrCreateDecalDefaultSampler(
    options.app,
    options.cache,
    options.reuse,
    diagnostics,
  );

  if (defaultSampler === null) {
    return {
      valid: false,
      commands,
      diagnostics,
      report: baseDecalReport(options.decals, options.snapshotReport, 0, 0),
    };
  }

  const pipeline = options.pipeline.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipeline.getBindGroupLayout === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "decalFrame.missingPipelineLayouts",
          message: "Decal pipeline does not expose bind group layouts.",
        },
      ],
      report: baseDecalReport(options.decals, options.snapshotReport, 0, 0),
    };
  }

  const viewBindGroup = device.createBindGroup({
    label: "Decal/ViewBindGroup",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });

  let drawn = 0;
  let drawnBatches = 0;

  for (const batch of batches) {
    const sampler =
      batch.sampler === undefined || batch.sampler === null
        ? {
            cacheKey: DECAL_DEFAULT_SAMPLER_CACHE_KEY,
            resource: defaultSampler,
          }
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: batch.sampler,
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
      handle: batch.textureHandle,
      reuse: options.reuse,
      diagnostics: diagnostics as Parameters<
        typeof prepareAppTextureResource
      >[0]["diagnostics"],
    });

    if (texture === null) {
      continue;
    }

    const renderId = options.decals[batch.firstInstance]?.renderId ?? 0;
    const decalBindGroup = device.createBindGroup({
      label: `Decal/InstanceBindGroup/${texture.cacheKey}`,
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer.buffer } },
        { binding: 1, resource: texture.resource.view },
        { binding: 2, resource: sampler.resource.sampler },
      ],
    });

    commands.push(
      {
        kind: "setPipeline",
        renderId,
        pipelineKey: options.pipeline.cacheKey,
        pipeline: options.pipeline.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId,
        index: 0,
        resourceKey: "decal:view",
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId,
        index: 1,
        resourceKey: `decal:${texture.cacheKey}:${sampler.cacheKey}`,
        bindGroup: decalBindGroup,
      },
      {
        kind: "draw",
        renderId,
        vertexCount: 6,
        instanceCount: batch.instanceCount,
        firstVertex: 0,
        firstInstance: batch.firstInstance,
      },
    );
    drawn += batch.instanceCount;
    drawnBatches += 1;
  }

  return {
    valid: diagnostics.length === 0,
    commands,
    diagnostics,
    report: baseDecalReport(
      options.decals,
      options.snapshotReport,
      drawn,
      drawnBatches,
    ),
  };
}

export async function getOrCreateWebGpuAppDecalPipeline(
  app: WebGpuAppDecalContext,
  cache: WebGpuAppResourceCache,
): Promise<CreateDecalRenderPipelineResourceResult> {
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = decalPipelineCacheKey(
    colorFormat,
    cache.sceneDepthFormat,
    app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  );
  const cached = cache.decalPipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createDecalRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createDecalRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: cache.sceneDepthFormat,
    sampleCount: app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  });

  cache.decalPipelines.set(key, result);
  return result;
}

/**
 * Contiguous same-texture (+ sampler) runs over the sort-ordered decal packets.
 * Maximal runs keep the depth sort exact while collapsing each run into one
 * instanced draw (a single-texture bullet-hole scene is one batch).
 */
export function decalTextureBatches(
  decals: readonly DecalPacket[],
): readonly DecalTextureBatch[] {
  const batches: DecalTextureBatch[] = [];
  let startIndex = 0;
  let count = 0;
  let currentKey: string | null = null;
  let currentTexture: DecalPacket["texture"] | null = null;
  let currentSampler: DecalPacket["sampler"] = null;

  const flush = (): void => {
    if (count > 0 && currentTexture !== null) {
      batches.push({
        textureHandle: currentTexture,
        sampler: currentSampler,
        firstInstance: startIndex,
        instanceCount: count,
      });
    }
  };

  for (let index = 0; index < decals.length; index += 1) {
    const decal = decals[index];

    if (decal === undefined) {
      continue;
    }

    const samplerKey =
      decal.sampler === undefined || decal.sampler === null
        ? DECAL_DEFAULT_SAMPLER_CACHE_KEY
        : assetHandleKey(decal.sampler);
    const key = `${assetHandleKey(decal.texture)}:${samplerKey}`;

    if (currentKey === null || currentKey !== key) {
      flush();
      startIndex = index;
      count = 0;
      currentKey = key;
      currentTexture = decal.texture;
      currentSampler = decal.sampler ?? null;
    }

    count += 1;
  }

  flush();
  return batches;
}

/**
 * Pack the sort-ordered decals into the storage-buffer instance layout the
 * decal shader reads: a baked world matrix, tint (fade in alpha), size + depth
 * bias, and a UV rect per instance.
 */
export function packDecalInstances(
  snapshot: RenderSnapshot,
  decals: readonly DecalPacket[],
): Float32Array {
  const transforms = snapshot.transforms;
  const data = new Float32Array(
    Math.max(1, decals.length) * DECAL_INSTANCE_FLOAT_STRIDE,
  );

  for (let index = 0; index < decals.length; index += 1) {
    const decal = decals[index];

    if (decal === undefined) {
      continue;
    }

    const target = index * DECAL_INSTANCE_FLOAT_STRIDE;
    const source = decal.worldTransformOffset;

    for (let element = 0; element < 16; element += 1) {
      data[target + element] = transforms[source + element] ?? 0;
    }

    const color = decal.color;

    data[target + 16] = color[0] ?? 1;
    data[target + 17] = color[1] ?? 1;
    data[target + 18] = color[2] ?? 1;
    data[target + 19] = color[3] ?? 1;
    data[target + 20] = decal.width;
    data[target + 21] = decal.height;
    data[target + 22] = decal.depthOffset;
    data[target + 23] = 0;
    data[target + 24] = 0;
    data[target + 25] = 0;
    data[target + 26] = 1;
    data[target + 27] = 1;
  }

  return data;
}

function decalViewUniformData(
  viewUniforms: PackedSnapshotViewUniforms,
): Float32Array | null {
  const record = viewUniforms.views[0];

  if (record === undefined) {
    return null;
  }

  // The decal shader's ViewProjectionUniform is the first 20 floats of a packed
  // view record: view-projection (16) + camera position (4).
  const base = record.packedOffset;

  if (base + 20 > viewUniforms.data.length) {
    return null;
  }

  return viewUniforms.data.slice(base, base + 20);
}

function baseDecalReport(
  decals: readonly DecalPacket[],
  snapshotReport: DecalSnapshotReport | undefined,
  drawn: number,
  textureBatches: number,
): DecalFrameReport {
  return {
    capacity: snapshotReport?.capacity ?? decals.length,
    live: snapshotReport?.live ?? decals.length,
    evicted: snapshotReport?.evicted ?? 0,
    submitted: snapshotReport?.submitted ?? decals.length,
    drawn,
    textureBatches,
  };
}

function getOrCreateDecalDefaultSampler(
  app: WebGpuAppDecalContext,
  cache: WebGpuAppResourceCache,
  reuse: WebGpuAppResourceReuseReport,
  diagnostics: unknown[],
): SamplerGpuResource | null {
  const cached = cache.samplers.get(DECAL_DEFAULT_SAMPLER_CACHE_KEY);

  if (cached !== undefined) {
    reuse.samplerResourcesReused += 1;
    return cached;
  }

  const sampler = createSamplerGpuResource({
    device: app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey: DECAL_DEFAULT_SAMPLER_CACHE_KEY,
    sampler: createSamplerAsset({
      label: "DecalDefaultSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  diagnostics.push(...sampler.diagnostics);

  if (!sampler.valid || sampler.resource === null) {
    return null;
  }

  cache.samplers.set(DECAL_DEFAULT_SAMPLER_CACHE_KEY, sampler.resource);
  reuse.samplerResourcesCreated += 1;
  return sampler.resource;
}
