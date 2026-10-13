import type { MaterialQueueItem, MeshAsset, MeshDrawPacket } from "@aperture-engine/render";
import type { QueuedMaterialAdapterRegistration } from "./queued-material-adapter.js";
import type { QueuedMaterialPrepareRouteResult } from "./queued-material-prepare-route.js";
import { type WebGpuAppMaterialQueueRouteDiagnostic, type WebGpuAppMaterialQueueRouteQueueItem, type WebGpuAppMaterialQueueRouteReportJsonValue, type WebGpuAppMaterialQueueRouteReportShell, type WebGpuAppMaterialQueueRouteRoutedItem } from "../../materials/core/material-queue-route-report.js";
export interface QueuedMaterialAppResourceItem<TMaterial = unknown, TAdapter extends QueuedMaterialAdapterRegistration = QueuedMaterialAdapterRegistration> {
    readonly queueItem: MaterialQueueItem;
    readonly prepareRoute: QueuedMaterialPrepareRouteResult;
    readonly adapter: TAdapter;
    readonly draw: MeshDrawPacket;
    readonly mesh: MeshAsset;
    readonly meshKey: string;
    readonly sourceMeshKey: string;
    readonly material: TMaterial;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
}
export interface QueuedMaterialAppResourceSet<TItem extends QueuedMaterialAppResourceItem = QueuedMaterialAppResourceItem> {
    readonly items: readonly TItem[];
}
export interface QueuedMaterialAppResourceItemJsonValue {
    readonly renderId: number;
    readonly drawIndex: number;
    readonly materialFamily: string;
    readonly renderPhase: string;
    readonly pipelineKey: string;
    readonly meshKey: string;
    readonly sourceMeshKey: string;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly meshResourceKey: string;
    readonly materialResourceKey: string;
}
export interface QueuedMaterialAppRouteReportDiagnostic {
    readonly code: "webGpuApp.materialQueueRouteReport";
    readonly message: string;
    readonly routedItems: readonly QueuedMaterialAppResourceItemJsonValue[];
    readonly report: WebGpuAppMaterialQueueRouteReportJsonValue;
}
export interface CreateQueuedMaterialAppResourceItemOptions<TMaterial, TAdapter extends QueuedMaterialAdapterRegistration> {
    readonly queueItem: MaterialQueueItem;
    readonly prepareRoute: QueuedMaterialPrepareRouteResult;
    readonly adapter: TAdapter;
    readonly draw: MeshDrawPacket;
    readonly mesh: MeshAsset;
    readonly meshKey: string;
    readonly sourceMeshKey: string;
    readonly material: TMaterial;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
}
export declare function createQueuedMaterialAppResourceItem<TMaterial, TAdapter extends QueuedMaterialAdapterRegistration>(options: CreateQueuedMaterialAppResourceItemOptions<TMaterial, TAdapter>): QueuedMaterialAppResourceItem<TMaterial, TAdapter>;
export declare function queuedMaterialAppResourceItemToRouteRoutedItem(item: QueuedMaterialAppResourceItem): WebGpuAppMaterialQueueRouteRoutedItem;
export declare function queuedMaterialAppResourceItemToJsonValue(item: QueuedMaterialAppResourceItem): QueuedMaterialAppResourceItemJsonValue;
export declare function materialQueueItemToRouteQueueItem(item: MaterialQueueItem): WebGpuAppMaterialQueueRouteQueueItem;
export declare function createQueuedMaterialAppRouteReportDiagnostic(input: {
    readonly queueItems: readonly MaterialQueueItem[];
    readonly routedItems: readonly QueuedMaterialAppResourceItem[];
    readonly diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
    readonly shell: WebGpuAppMaterialQueueRouteReportShell;
}): QueuedMaterialAppRouteReportDiagnostic;
//# sourceMappingURL=queued-material-app-resource-item.d.ts.map