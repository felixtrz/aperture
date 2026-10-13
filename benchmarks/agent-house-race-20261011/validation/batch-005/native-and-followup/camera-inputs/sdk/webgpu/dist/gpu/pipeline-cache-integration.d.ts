import type { WebGpuRenderPipelineCache, WebGpuRenderPipelineCacheFailureReason, WebGpuRenderPipelineCacheStatus, WebGpuRenderPipelineDeviceLike } from "./pipeline-cache.js";
import type { UnlitPipelineDescriptorPlan } from "../materials/unlit/unlit-pipeline-descriptor.js";
export type PipelineCacheIntegrationDiagnosticCode = "pipelineCacheIntegration.nullDescriptorPlan" | "pipelineCacheIntegration.pipelineCreationFailed";
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
    readonly reason: "null-descriptor-plan" | WebGpuRenderPipelineCacheFailureReason;
    readonly key?: string;
    readonly diagnostics: readonly PipelineCacheIntegrationDiagnostic[];
}
export type GetOrCreateRenderPipelineResult = GetOrCreateRenderPipelineSuccess | GetOrCreateRenderPipelineFailure;
export declare function getOrCreateRenderPipelineFromPlan(options: GetOrCreateRenderPipelineOptions): GetOrCreateRenderPipelineResult;
//# sourceMappingURL=pipeline-cache-integration.d.ts.map