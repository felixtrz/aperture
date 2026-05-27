import { type AssetRegistry } from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type RenderSnapshot,
  type SpriteDrawPacket,
} from "@aperture-engine/render";
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
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
} from "./app-texture-sampler-resources.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";

interface WebGpuAppSpriteContext {
  readonly initialization: {
    readonly device: unknown;
    readonly format: string;
  };
  readonly msaa: {
    readonly sampleCount: number;
  };
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

  if (spriteDraws.length === 0) {
    return {
      pipeline: null,
      resources: {
        valid: true,
        commands: [],
        diagnostics: [],
      },
    };
  }

  const pipeline = await getOrCreateWebGpuAppSpritePipeline(
    options.app,
    options.cache,
  );

  if (!pipeline.valid || pipeline.resource === null) {
    return {
      pipeline,
      resources: {
        valid: false,
        commands: [],
        diagnostics: pipeline.diagnostics,
      },
    };
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
      pipeline: pipeline.resource,
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
  readonly reuse: WebGpuAppResourceReuseReport;
}): SpriteFrameResources {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  const pipeline = options.pipeline.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };
  const viewUniformData = options.viewUniforms.data.subarray(
    0,
    options.viewUniforms.floatCount ?? options.viewUniforms.data.length,
  );
  const worldTransformData = options.worldTransforms.data.subarray(
    0,
    options.worldTransforms.floatCount ?? options.worldTransforms.data.length,
  );

  if (pipeline.getBindGroupLayout === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "spriteFrame.missingPipelineLayouts",
          message: "Sprite pipeline does not expose bind group layouts.",
        },
      ],
    };
  }

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
  const spriteData = packSpriteData(options.snapshot, options.spriteDraws);
  const spriteBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/Data",
      size: spriteData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: spriteData,
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

  const viewBindGroup = device.createBindGroup({
    label: "Sprite/ViewBindGroup",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });
  const transformBindGroup = device.createBindGroup({
    label: "Sprite/TransformBindGroup",
    layout: pipeline.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: { buffer: transformBuffer.buffer } }],
  });

  for (const draw of options.spriteDraws) {
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
        pipelineKey: options.pipeline.cacheKey,
        pipeline: options.pipeline.pipeline,
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
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: draw.worldTransformOffset / 16,
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
): Promise<CreateSpriteRenderPipelineResourceResult> {
  const key = spritePipelineCacheKey(
    app.initialization.format,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
  );
  const cached = cache.spritePipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createSpriteRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createSpriteRenderPipelineResource
    >[0]["device"],
    colorFormat: app.initialization.format,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: app.msaa.sampleCount,
  });

  cache.spritePipelines.set(key, result);
  return result;
}

function packSpriteData(
  snapshot: RenderSnapshot,
  spriteDraws: readonly SpriteDrawPacket[],
): Float32Array {
  const transformCount = Math.max(
    1,
    Math.ceil(snapshot.transforms.length / 16),
  );
  const data = new Float32Array(transformCount * 8);

  for (const draw of spriteDraws) {
    const index = Math.floor(draw.worldTransformOffset / 16);
    const offset = index * 8;

    data.set(draw.color, offset);
    data[offset + 4] = draw.width;
    data[offset + 5] = draw.height;
  }

  return data;
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
