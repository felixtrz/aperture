import type { MaterialAssetDependencyReadinessReportJsonValue, MaterialQueuePhaseSummary, RenderQueueSortPhaseReport } from "@aperture-engine/render";
import type { QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue } from "../materials/core/built-in-material-app-resource-adapter.js";
import type { DirectLightReadinessReport } from "../lighting/direct-light-readiness.js";
import type { GpuPassTimingReport } from "../gpu/gpu-timing.js";
import type { WebGpuAppMaterialQueueRouteReportJsonValue } from "../materials/core/material-queue-route-report.js";
import type { QueuedMaterialFrameResourceSetSummary } from "../render/queues/queued-material-frame-resource-set-summary.js";
import type { RenderFrameQueueDiagnosticsSummary } from "../render/frame/render-frame-plan.js";
export interface WebGpuAppDiagnosticsSummaryInput {
    readonly materialQueue?: MaterialQueuePhaseSummary;
    readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
    readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
    readonly builtInAppResourceAdapters?: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
    readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
    readonly renderQueueSortPhases?: readonly RenderQueueSortPhaseReport[];
    readonly gpuTimings?: GpuPassTimingReport;
    readonly directLighting?: DirectLightReadinessReport;
}
export interface WebGpuAppDiagnosticsSummary {
    readonly sectionCount: number;
    readonly materialQueue?: MaterialQueuePhaseSummary;
    readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
    readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
    readonly builtInAppResourceAdapters?: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
    readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
    readonly renderQueueSortPhases?: readonly RenderQueueSortPhaseReport[];
    readonly gpuTimings?: GpuPassTimingReport;
    readonly directLighting?: DirectLightReadinessReport;
}
export declare function createWebGpuAppDiagnosticsSummary(input: WebGpuAppDiagnosticsSummaryInput): WebGpuAppDiagnosticsSummary;
export declare function collectWebGpuAppMaterialQueueRouteReport(diagnostics: readonly unknown[]): WebGpuAppMaterialQueueRouteReportJsonValue | null;
export declare function collectWebGpuAppMaterialDependencyReadiness(diagnostics: readonly unknown[]): MaterialAssetDependencyReadinessReportJsonValue[];
//# sourceMappingURL=app-diagnostics-summary.d.ts.map