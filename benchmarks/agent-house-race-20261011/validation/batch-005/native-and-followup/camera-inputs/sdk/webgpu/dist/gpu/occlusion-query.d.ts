export declare const GPU_OCCLUSION_QUERY_BYTES: number;
export declare const GPU_OCCLUSION_MAP_READ = 1;
export type GpuOcclusionQueryDiagnosticCode = "gpuOcclusion.invalidQueryCount" | "gpuOcclusion.missingDeviceSupport" | "gpuOcclusion.resourceCreationFailed" | "gpuOcclusion.commandEncodingUnsupported" | "gpuOcclusion.readbackUnavailable";
export interface GpuOcclusionQueryDiagnostic {
    readonly code: GpuOcclusionQueryDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface GpuOcclusionQueryDeviceLike {
    readonly createQuerySet?: (descriptor: {
        readonly label?: string;
        readonly type: "occlusion";
        readonly count: number;
    }) => unknown;
    readonly createBuffer?: (descriptor: {
        readonly label?: string;
        readonly size: number;
        readonly usage: number;
    }) => GpuOcclusionBufferLike;
}
export interface GpuOcclusionCommandEncoderLike {
    readonly resolveQuerySet?: (querySet: unknown, firstQuery: number, queryCount: number, destination: unknown, destinationOffset: number) => void;
    readonly copyBufferToBuffer?: (source: unknown, sourceOffset: number, destination: unknown, destinationOffset: number, size: number) => void;
}
export interface GpuOcclusionBufferLike {
    readonly mapAsync?: (mode: number, offset?: number, size?: number) => Promise<void>;
    readonly getMappedRange?: (offset?: number, size?: number) => ArrayBuffer | ArrayBufferView;
    readonly unmap?: () => void;
}
export interface GpuOcclusionQueryResources {
    readonly label: string;
    readonly queryCount: number;
    readonly byteLength: number;
    readonly querySet: unknown;
    readonly resolveBuffer: GpuOcclusionBufferLike;
    readonly readbackBuffer: GpuOcclusionBufferLike;
}
export interface CreateGpuOcclusionQueryResourcesOptions {
    readonly device: GpuOcclusionQueryDeviceLike;
    readonly label?: string;
    readonly queryCount: number;
}
export interface CreateGpuOcclusionQueryResourcesResult {
    readonly supported: boolean;
    readonly resources: GpuOcclusionQueryResources | null;
    readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
}
export interface GpuOcclusionQueryResolveReport {
    readonly valid: boolean;
    readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
}
export interface GpuOcclusionQueryReadbackResult {
    readonly valid: boolean;
    readonly testedRenderIds: readonly number[];
    readonly visibleRenderIds: readonly number[];
    readonly occludedRenderIds: readonly number[];
    readonly sampleCounts: readonly string[];
    readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
}
export type GpuOcclusionFeedbackStatus = "empty" | "ready" | "unsupported";
export type GpuOcclusionFeedbackFallbackReason = "not-ready" | "unsupported";
export interface GpuOcclusionFeedbackState {
    readonly occludedQueryKeys: Set<string>;
    readonly lastTestedFrameByQueryKey: Map<string, number>;
    status: GpuOcclusionFeedbackStatus;
}
export interface GpuOcclusionFeedbackCullingPlan {
    readonly candidateDraws: number;
    readonly skippedRenderIds: readonly number[];
    readonly forcedProbeRenderIds: readonly number[];
    readonly fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
}
export interface PlanGpuOcclusionFeedbackCullingOptions {
    readonly state: GpuOcclusionFeedbackState;
    readonly viewId: number;
    readonly frame: number;
    readonly candidateRenderIds: readonly number[];
    readonly forceProbeInterval?: number;
}
export interface UpdateGpuOcclusionFeedbackStateOptions {
    readonly state: GpuOcclusionFeedbackState;
    readonly viewId: number;
    readonly frame: number;
    readonly status: "inactive" | "ready" | "unsupported";
    readonly testedRenderIds: readonly number[];
    readonly visibleRenderIds: readonly number[];
    readonly occludedRenderIds: readonly number[];
}
export declare function createGpuOcclusionQueryResources(options: CreateGpuOcclusionQueryResourcesOptions): CreateGpuOcclusionQueryResourcesResult;
export declare function createGpuOcclusionFeedbackState(): GpuOcclusionFeedbackState;
export declare function planGpuOcclusionFeedbackCulling(options: PlanGpuOcclusionFeedbackCullingOptions): GpuOcclusionFeedbackCullingPlan;
export declare function updateGpuOcclusionFeedbackState(options: UpdateGpuOcclusionFeedbackStateOptions): void;
export declare function resolveGpuOcclusionQueries(encoder: GpuOcclusionCommandEncoderLike, resources: GpuOcclusionQueryResources, queryCount?: number): GpuOcclusionQueryResolveReport;
export declare function readGpuOcclusionQueryResults(resources: GpuOcclusionQueryResources, renderIds: readonly number[]): Promise<GpuOcclusionQueryReadbackResult>;
//# sourceMappingURL=occlusion-query.d.ts.map