import type { LocalLightClusterDescriptor, LocalLightClusterGpuResource, LocalLightClusterReport } from "./local-light-cluster-types.js";
export interface LocalLightClusterDeferredSamplingDiagnostic {
    readonly code: "webGpuApp.clusteredLocalShadowSamplingDeferred" | "webGpuApp.clusteredLocalCookieSamplingDeferred";
    readonly severity: "warning";
    readonly deferredLightCount: number;
    readonly fallbackReason: string | null;
    readonly message: string;
}
/**
 * AI-18: make the silent clustered shadow/cookie fallback loud. When a shadow or
 * cookie was requested for clustered local lights but the selected pipeline variant
 * cannot sample it, the cluster summary reports `status:'metadata-only'` and the
 * shader emits a near-1.0 sentinel (host-undetectable). Derive a structured warning
 * so the host can observe the deferral instead of only seeing the sentinel.
 */
export declare function localLightClusterDeferredSamplingDiagnostics(report: LocalLightClusterReport | undefined): readonly LocalLightClusterDeferredSamplingDiagnostic[];
export declare function localLightClusterReportFromDescriptor(descriptor: LocalLightClusterDescriptor, options?: {
    readonly resource?: LocalLightClusterGpuResource | null;
    readonly buffersCreated?: number;
    readonly buffersReused?: number;
    readonly bufferWrites?: number;
    readonly bufferWritesSkipped?: number;
}): LocalLightClusterReport;
//# sourceMappingURL=local-light-cluster-report.d.ts.map