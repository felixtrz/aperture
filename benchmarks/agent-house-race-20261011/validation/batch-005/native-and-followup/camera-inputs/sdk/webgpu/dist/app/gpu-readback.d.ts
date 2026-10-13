import { type GpuPassTimingReport, type GpuTimestampQueryDiagnostic, type GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
import { type GpuOcclusionFeedbackFallbackReason, type GpuOcclusionFeedbackState, type GpuOcclusionQueryDiagnostic, type GpuOcclusionQueryResources } from "../gpu/occlusion-query.js";
import { type WebGpuAppDiagnosticsSummary } from "./app-diagnostics-summary.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppOcclusionQueryReport } from "./app.js";
interface WebGpuAppGpuDeviceContext {
    readonly initialization: {
        readonly device: unknown;
    };
}
interface WebGpuAppOcclusionCullingState {
    readonly queryCandidateDraws: number;
    readonly queriedDraws: number;
    readonly skippedFromQuery: number;
    readonly skippedRenderIds: readonly number[];
    readonly forcedProbeDraws: number;
    readonly forcedProbeRenderIds: readonly number[];
    readonly fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
}
export interface WebGpuAppGpuTimingReadback {
    readonly passName: string;
    readonly passNames?: readonly string[];
    readonly resources: GpuTimestampQueryResources;
    /**
     * Returns the frame's readback buffer to the pass's rotation ring once the
     * CPU read unmapped it (or once the owner knows it will never map it).
     * Until then the buffer must not be reused by another frame's submit.
     */
    readonly release?: () => void;
}
export interface WebGpuAppOcclusionQueryReadback {
    readonly passName: string;
    readonly viewId: number;
    readonly resources: GpuOcclusionQueryResources;
    readonly renderIds: readonly number[];
}
export interface WebGpuAppGpuTimingFrameLease {
    readonly passName: string;
    readonly resources: GpuTimestampQueryResources | null;
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
    readonly release?: () => void;
}
export declare function createWebGpuAppGpuTimingForTarget(app: WebGpuAppGpuDeviceContext, cache: WebGpuAppResourceCache, label: string, target: WebGpuAppFrameBoundaryTarget): Promise<WebGpuAppGpuTimingFrameLease>;
export declare function createWebGpuAppGpuTimingForPass(app: WebGpuAppGpuDeviceContext, cache: WebGpuAppResourceCache, label: string, passName: string, queryCount: number): Promise<WebGpuAppGpuTimingFrameLease>;
/**
 * Returns leased timing readback buffers without reading them. Frame paths
 * that encode GPU timestamps but never map the readback (no timing report on
 * their route) must release their leases or the rotation ring would saturate
 * and silently disable timing.
 */
export declare function releaseWebGpuAppGpuTimingReadbacks(readbacks: readonly WebGpuAppGpuTimingReadback[]): void;
export declare function readWebGpuAppGpuTimings(input: {
    readonly readbacks: readonly WebGpuAppGpuTimingReadback[];
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}): Promise<GpuPassTimingReport | undefined>;
export declare function readWebGpuAppOcclusionQueries(input: {
    readonly readbacks: readonly WebGpuAppOcclusionQueryReadback[];
    readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
    readonly queryCount: number;
    readonly frame: number;
    readonly feedbackState: GpuOcclusionFeedbackState;
    readonly culling: WebGpuAppOcclusionCullingState;
}): Promise<WebGpuAppOcclusionQueryReport | undefined>;
export declare function newOcclusionQueryDiagnostics(report: WebGpuAppOcclusionQueryReport | undefined, existing: readonly GpuOcclusionQueryDiagnostic[]): readonly GpuOcclusionQueryDiagnostic[];
export declare function createWebGpuAppDiagnosticsSummaryWithGpuTimings(summary: WebGpuAppDiagnosticsSummary, gpuTimings: GpuPassTimingReport): WebGpuAppDiagnosticsSummary;
export {};
//# sourceMappingURL=gpu-readback.d.ts.map