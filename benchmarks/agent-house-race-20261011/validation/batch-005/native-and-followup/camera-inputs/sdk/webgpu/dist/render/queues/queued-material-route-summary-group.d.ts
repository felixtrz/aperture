import type { QueuedMaterialPrepareRouteResult, QueuedMaterialPrepareRouteStatus } from "./queued-material-prepare-route.js";
import type { QueuedMaterialFrameResourceRouteShellSummary, QueuedMaterialFrameResourceRouteStatus } from "./queued-material-frame-resource-route.js";
export interface QueuedMaterialPrepareRouteSummary {
    readonly valid: boolean;
    readonly status: QueuedMaterialPrepareRouteStatus;
    readonly family: string;
    readonly hasFacadeMeshResourceKey: boolean;
    readonly hasFacadeMaterialResourceKey: boolean;
    readonly pipelineKey: string;
    readonly sourceVersion: number;
    readonly frame: number;
    readonly diagnostics: {
        readonly total: number;
        readonly byCode: Record<string, number>;
    };
}
export type QueuedMaterialPrepareRouteSummaryJsonValue = QueuedMaterialPrepareRouteSummary;
export interface QueuedMaterialRouteSummaryStage<TStatus extends string = string> {
    readonly total: number;
    readonly valid: number;
    readonly invalid: number;
    readonly byStatus: Record<TStatus, number>;
    readonly diagnostics: {
        readonly total: number;
        readonly byCode: Record<string, number>;
    };
}
export interface QueuedMaterialRouteSummaryGroup {
    readonly prepareRoutes: QueuedMaterialRouteSummaryStage<QueuedMaterialPrepareRouteStatus>;
    readonly frameResources: QueuedMaterialRouteSummaryStage<QueuedMaterialFrameResourceRouteStatus>;
    readonly diagnostics: {
        readonly total: number;
        readonly byCode: Record<string, number>;
    };
}
export type QueuedMaterialRouteSummaryGroupJsonValue = QueuedMaterialRouteSummaryGroup;
export declare function createQueuedMaterialPrepareRouteSummary(route: QueuedMaterialPrepareRouteResult): QueuedMaterialPrepareRouteSummary;
export declare function queuedMaterialPrepareRouteSummaryToJsonValue(summary: QueuedMaterialPrepareRouteSummary): QueuedMaterialPrepareRouteSummaryJsonValue;
export declare function createQueuedMaterialRouteSummaryGroup(input: {
    readonly prepareRoutes?: readonly QueuedMaterialPrepareRouteSummary[];
    readonly frameResources?: readonly QueuedMaterialFrameResourceRouteShellSummary[];
}): QueuedMaterialRouteSummaryGroup;
export declare function queuedMaterialRouteSummaryGroupToJsonValue(group: QueuedMaterialRouteSummaryGroup): QueuedMaterialRouteSummaryGroupJsonValue;
//# sourceMappingURL=queued-material-route-summary-group.d.ts.map