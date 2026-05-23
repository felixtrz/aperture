import type { MeshTopology } from "@aperture-engine/render";
import type { BatchCompatibilityKey } from "@aperture-engine/render";

export type WebGpuRenderPipelineCacheFailureReason =
  "create-render-pipeline-unavailable";

export type WebGpuRenderPipelineCacheStatus = "hit" | "miss";

export interface WebGpuRenderPipelinePrimitiveStateKey {
  readonly topology?: MeshTopology;
  readonly cullMode?: string;
  readonly frontFace?: string;
  readonly stripIndexFormat?: string | null;
}

export interface WebGpuRenderPipelineDepthStencilStateKey {
  readonly format?: string | null;
  readonly depthWriteEnabled?: boolean;
  readonly depthCompare?: string;
  readonly stencilReadMask?: number;
  readonly stencilWriteMask?: number;
}

export interface WebGpuRenderPipelineColorTargetStateKey {
  readonly format?: string;
  readonly blend?: unknown;
  readonly writeMask?: string | number;
}

export interface WebGpuRenderPipelineBlendStateKey {
  readonly alphaToCoverageEnabled?: boolean;
  readonly colorTargets?: readonly WebGpuRenderPipelineColorTargetStateKey[];
}

export interface WebGpuRenderPipelineCacheKeyInput {
  readonly shaderLabel: string;
  readonly shaderFamily?: string;
  readonly shaderVariantKey?: string;
  readonly colorFormats: readonly string[];
  readonly depthFormat?: string | null;
  readonly stencilFormat?: string | null;
  readonly topology?: MeshTopology;
  readonly vertexLayoutKey?: string;
  readonly bindGroupLayoutKeys?: readonly string[];
  readonly primitive?: WebGpuRenderPipelinePrimitiveStateKey;
  readonly depthStencil?: WebGpuRenderPipelineDepthStencilStateKey;
  readonly blend?: WebGpuRenderPipelineBlendStateKey;
  readonly sampleCount?: number;
  readonly materialPipelineKey?: string;
  readonly materialVariantKey?: string;
  readonly batchKey: BatchCompatibilityKey;
}

export interface WebGpuRenderPipelineCreateDescriptor {
  readonly label?: string;
  readonly [key: string]: unknown;
}

export interface WebGpuRenderPipelineDeviceLike {
  createRenderPipeline?: (
    descriptor: WebGpuRenderPipelineCreateDescriptor,
  ) => unknown;
}

export interface WebGpuRenderPipelineCacheRequest {
  readonly device: WebGpuRenderPipelineDeviceLike;
  readonly key: WebGpuRenderPipelineCacheKeyInput;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface WebGpuRenderPipelineCacheSuccess {
  readonly ok: true;
  readonly status: WebGpuRenderPipelineCacheStatus;
  readonly key: string;
  readonly pipeline: unknown;
}

export interface WebGpuRenderPipelineCacheFailure {
  readonly ok: false;
  readonly reason: WebGpuRenderPipelineCacheFailureReason;
  readonly message: string;
  readonly key: string;
}

export type WebGpuRenderPipelineCacheResult =
  | WebGpuRenderPipelineCacheSuccess
  | WebGpuRenderPipelineCacheFailure;

export class WebGpuRenderPipelineCache {
  readonly #pipelines = new Map<string, unknown>();

  get size(): number {
    return this.#pipelines.size;
  }

  has(input: WebGpuRenderPipelineCacheKeyInput | string): boolean {
    return this.#pipelines.has(resolveKey(input));
  }

  clear(): void {
    this.#pipelines.clear();
  }

  getOrCreate(
    request: WebGpuRenderPipelineCacheRequest,
  ): WebGpuRenderPipelineCacheResult {
    const key = createWebGpuRenderPipelineCacheKey(request.key);
    const existing = this.#pipelines.get(key);

    if (existing !== undefined) {
      return { ok: true, status: "hit", key, pipeline: existing };
    }

    if (request.device.createRenderPipeline === undefined) {
      return {
        ok: false,
        reason: "create-render-pipeline-unavailable",
        key,
        message: "WebGPU device cannot create render pipelines.",
      };
    }

    const pipeline = request.device.createRenderPipeline(request.descriptor);

    this.#pipelines.set(key, pipeline);
    return { ok: true, status: "miss", key, pipeline };
  }
}

export function createWebGpuRenderPipelineCacheKey(
  input: WebGpuRenderPipelineCacheKeyInput,
): string {
  const topology =
    input.primitive?.topology ?? input.topology ?? input.batchKey.topology;
  const depthFormat = input.depthStencil?.format ?? input.depthFormat ?? null;

  return JSON.stringify({
    shader: {
      label: input.shaderLabel,
      family: input.shaderFamily ?? input.shaderLabel,
      variantKey: input.shaderVariantKey ?? input.batchKey.pipelineKey,
    },
    targets: {
      colorFormats: [...input.colorFormats],
      depthFormat,
      stencilFormat: input.stencilFormat ?? null,
    },
    layouts: {
      vertex: input.vertexLayoutKey ?? input.batchKey.meshLayoutKey,
      bindGroups: [...(input.bindGroupLayoutKeys ?? [])],
    },
    primitive: {
      topology,
      cullMode: input.primitive?.cullMode ?? "none",
      frontFace: input.primitive?.frontFace ?? "ccw",
      stripIndexFormat: input.primitive?.stripIndexFormat ?? null,
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: input.depthStencil?.depthWriteEnabled ?? false,
      depthCompare: input.depthStencil?.depthCompare ?? "always",
      stencilReadMask: input.depthStencil?.stencilReadMask ?? 0,
      stencilWriteMask: input.depthStencil?.stencilWriteMask ?? 0,
    },
    blend: {
      alphaToCoverageEnabled: input.blend?.alphaToCoverageEnabled ?? false,
      colorTargets:
        input.blend?.colorTargets?.map((target) => ({
          format: target.format ?? null,
          blend: target.blend ?? null,
          writeMask: target.writeMask ?? "all",
        })) ??
        input.colorFormats.map((format) => ({
          format,
          blend: null,
          writeMask: "all",
        })),
    },
    multisample: {
      sampleCount: input.sampleCount ?? 1,
    },
    material: {
      pipelineKey: input.materialPipelineKey ?? input.batchKey.pipelineKey,
      variantKey: input.materialVariantKey ?? input.batchKey.materialKey,
    },
    batch: {
      pipelineKey: input.batchKey.pipelineKey,
      materialKey: input.batchKey.materialKey,
      meshLayoutKey: input.batchKey.meshLayoutKey,
      topology: input.batchKey.topology,
      instanced: input.batchKey.instanced,
      skinned: input.batchKey.skinned,
      morphed: input.batchKey.morphed,
    },
  });
}

function resolveKey(input: WebGpuRenderPipelineCacheKeyInput | string): string {
  return typeof input === "string"
    ? input
    : createWebGpuRenderPipelineCacheKey(input);
}
