import type {
  WebGpuRenderPipelineCacheFailureReason,
  WebGpuRenderPipelineCacheStatus,
} from "./pipeline-cache.js";
import { WebGpuRenderPipelineCache } from "./pipeline-cache.js";
import type { WebGpuRenderPipelineDeviceLike } from "./pipeline-cache.js";
import type { UnlitPipelineDescriptorPlan } from "./unlit-pipeline-descriptor.js";

export type PipelineCacheIntegrationDiagnosticCode =
  | "pipelineCacheIntegration.nullDescriptorPlan"
  | "pipelineCacheIntegration.pipelineCreationFailed";

export interface PipelineCacheIntegrationDiagnostic {
  readonly code: PipelineCacheIntegrationDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuRenderPipelineCacheFailureReason;
}

export interface GetOrCreateRenderPipelineOptions {
  readonly cache: WebGpuRenderPipelineCache;
  readonly device: WebGpuRenderPipelineDeviceLike;
  readonly plan: UnlitPipelineDescriptorPlan | null;
}

export interface GetOrCreateRenderPipelineSuccess {
  readonly ok: true;
  readonly status: WebGpuRenderPipelineCacheStatus;
  readonly key: string;
  readonly pipeline: unknown;
  readonly diagnostics: readonly PipelineCacheIntegrationDiagnostic[];
}

export interface GetOrCreateRenderPipelineFailure {
  readonly ok: false;
  readonly reason:
    | "null-descriptor-plan"
    | WebGpuRenderPipelineCacheFailureReason;
  readonly key?: string;
  readonly diagnostics: readonly PipelineCacheIntegrationDiagnostic[];
}

export type GetOrCreateRenderPipelineResult =
  | GetOrCreateRenderPipelineSuccess
  | GetOrCreateRenderPipelineFailure;

export function getOrCreateRenderPipelineFromPlan(
  options: GetOrCreateRenderPipelineOptions,
): GetOrCreateRenderPipelineResult {
  if (options.plan === null) {
    return {
      ok: false,
      reason: "null-descriptor-plan",
      diagnostics: [
        {
          code: "pipelineCacheIntegration.nullDescriptorPlan",
          message:
            "Cannot create or retrieve a render pipeline from a null descriptor plan.",
        },
      ],
    };
  }

  const result = options.cache.getOrCreate({
    device: options.device,
    key: options.plan.keyInput,
    descriptor: options.plan.descriptor,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      key: result.key,
      diagnostics: [
        {
          code: "pipelineCacheIntegration.pipelineCreationFailed",
          reason: result.reason,
          message: result.message,
        },
      ],
    };
  }

  return {
    ok: true,
    status: result.status,
    key: result.key,
    pipeline: result.pipeline,
    diagnostics: [],
  };
}
