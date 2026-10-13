import { type AssetRegistry } from "@aperture-engine/simulation";
import { type MaterialAsset, type MaterialQueueScratch, type MeshAsset, type MeshDrawPacket, type PreparedMaterialStore, type PreparedMeshStore, type RenderSnapshot } from "@aperture-engine/render";
import type { BuiltInMaterialAsset } from "../../materials/core/built-in-material-queue-adapter.js";
import type { QueuedBuiltInAppResourceAdapter } from "../../materials/core/built-in-material-app-resource-adapter.js";
import type { QueuedMaterialAdapterRegistry } from "./queued-material-adapter.js";
import { type QueuedMaterialAppRouteReportDiagnostic, type QueuedMaterialAppResourceItem, type QueuedMaterialAppResourceSet } from "./queued-material-app-resource-item.js";
import type { ReusableRouteCollector } from "./reusable-route-collector.js";
import { type WebGpuAppMaterialQueueRouteReportShell } from "../../materials/core/material-queue-route-report.js";
import { type QueuedSourceMaterialAsset, type QueuedSourceMeshAsset } from "./queued-source-assets.js";
export type { WebGpuAppUnsupportedMaterialQueueDiagnostic } from "./queued-material-prepare-route-diagnostics.js";
export type QueuedBuiltInAppResourceItem = QueuedMaterialAppResourceItem<BuiltInMaterialAsset, QueuedBuiltInMaterialAdapter>;
export type QueuedBuiltInAppResourceSet = QueuedMaterialAppResourceSet<QueuedBuiltInAppResourceItem>;
export interface QueuedBuiltInAppRouteCollectorScratch {
    readonly sourceMeshAssets: Map<string, QueuedSourceMeshAsset>;
    readonly sourceMaterialAssets: Map<string, QueuedSourceMaterialAsset>;
    readonly routeCollector: ReusableRouteCollector<QueuedBuiltInAppResourceItem, unknown>;
    readonly routeReport: WebGpuAppMaterialQueueRouteReportShell;
}
export type WebGpuAppMaterialQueueRouteReportDiagnostic = QueuedMaterialAppRouteReportDiagnostic;
export type QueuedBuiltInMaterialAdapter = QueuedBuiltInAppResourceAdapter<unknown, unknown>;
export interface CollectQueuedBuiltInAppResourceSetOptions {
    readonly assets: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly materialQueueScratch: MaterialQueueScratch;
    readonly routeScratch: QueuedBuiltInAppRouteCollectorScratch;
    readonly meshes: PreparedMeshStore;
    readonly materials: PreparedMaterialStore;
    readonly adapters: QueuedMaterialAdapterRegistry<QueuedBuiltInMaterialAdapter>;
}
export interface CollectQueuedBuiltInAppResourceSetResult {
    readonly valid: boolean;
    readonly resourceSet: QueuedBuiltInAppResourceSet | null;
    readonly diagnostics: readonly unknown[];
}
export declare function createQueuedBuiltInAppRouteCollectorScratch(): QueuedBuiltInAppRouteCollectorScratch;
export declare function createSingleQueuedBuiltInAppResourceItem(options: {
    readonly adapters: QueuedMaterialAdapterRegistry<QueuedBuiltInMaterialAdapter>;
    readonly draw: MeshDrawPacket;
    readonly drawIndex: number;
    readonly mesh: MeshAsset;
    readonly meshKey: string;
    readonly material: MaterialAsset;
    readonly materialKey: string;
    readonly materialVersion: number;
    readonly frame: number;
}): QueuedBuiltInAppResourceItem | null;
export declare function collectQueuedBuiltInAppResourceSet(options: CollectQueuedBuiltInAppResourceSetOptions): CollectQueuedBuiltInAppResourceSetResult;
//# sourceMappingURL=queued-built-in-app-resource-set.d.ts.map