import type { QueuedMaterialPrepareRouteResult } from "./queued-material-prepare-route.js";
export type QueuedMaterialFrameResourceRouteStatus = "prepared" | "failed";
export interface QueuedMaterialFrameResourceResultLike<TDiagnostic = unknown> {
    readonly valid: boolean;
    readonly diagnostics: readonly TDiagnostic[];
}
export interface QueuedMaterialFrameResourceRouteShell<TDiagnostic = unknown> {
    readonly valid: boolean;
    readonly status: QueuedMaterialFrameResourceRouteStatus;
    readonly family: string;
    readonly facadeMeshResourceKey: string | null;
    readonly facadeMaterialResourceKey: string | null;
    readonly backendMeshKey: string;
    readonly backendMaterialKey: string;
    readonly pipelineKey: string;
    readonly sourceVersion: number;
    readonly frame: number;
    readonly diagnostics: readonly TDiagnostic[];
}
export interface QueuedMaterialFrameResourceRouteShellSummary {
    readonly valid: boolean;
    readonly status: QueuedMaterialFrameResourceRouteStatus;
    readonly family: string;
    readonly hasFacadeMeshResourceKey: boolean;
    readonly hasFacadeMaterialResourceKey: boolean;
    readonly hasBackendMeshKey: boolean;
    readonly hasBackendMaterialKey: boolean;
    readonly pipelineKey: string;
    readonly sourceVersion: number;
    readonly frame: number;
    readonly diagnostics: {
        readonly total: number;
        readonly byCode: Record<string, number>;
    };
}
export type QueuedMaterialFrameResourceRouteShellSummaryJsonValue = QueuedMaterialFrameResourceRouteShellSummary;
export declare function createQueuedMaterialFrameResourceRouteShell<TDiagnostic = unknown>(options: {
    readonly prepareRoute: QueuedMaterialPrepareRouteResult;
    readonly backendMeshKey: string;
    readonly backendMaterialKey: string;
    readonly frameResources: QueuedMaterialFrameResourceResultLike<TDiagnostic>;
}): QueuedMaterialFrameResourceRouteShell<TDiagnostic>;
export declare function createQueuedMaterialFrameResourceRouteShellSummary(shell: QueuedMaterialFrameResourceRouteShell): QueuedMaterialFrameResourceRouteShellSummary;
export declare function queuedMaterialFrameResourceRouteShellSummaryToJsonValue(summary: QueuedMaterialFrameResourceRouteShellSummary): QueuedMaterialFrameResourceRouteShellSummaryJsonValue;
//# sourceMappingURL=queued-material-frame-resource-route.d.ts.map