import type { MeshTopology } from "../mesh/index.js";
import type { BatchCompatibilityKey } from "../rendering/snapshot.js";

export type WebGpuRenderPipelineCacheFailureReason =
  "create-render-pipeline-unavailable";

export type WebGpuRenderPipelineCacheStatus = "hit" | "miss";

export interface WebGpuRenderPipelineCacheKeyInput {
  readonly shaderLabel: string;
  readonly colorFormats: readonly string[];
  readonly depthFormat?: string | null;
  readonly topology?: MeshTopology;
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
  return JSON.stringify({
    shaderLabel: input.shaderLabel,
    colorFormats: [...input.colorFormats],
    depthFormat: input.depthFormat ?? null,
    topology: input.topology ?? input.batchKey.topology,
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
