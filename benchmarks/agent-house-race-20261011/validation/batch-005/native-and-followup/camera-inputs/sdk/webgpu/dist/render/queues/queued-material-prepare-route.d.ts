import type { MaterialAsset, MaterialQueueItem } from "@aperture-engine/render";
import type { QueuedMaterialAdapterRegistration, QueuedMaterialAdapterRegistry } from "./queued-material-adapter.js";
export type QueuedMaterialPrepareRouteStatus = "prepared" | "reused" | "skipped" | "failed";
export type QueuedMaterialPrepareRouteDiagnosticCode = "queuedMaterialPrepareRoute.missingAdapter" | "queuedMaterialPrepareRoute.materialMismatch";
export interface QueuedMaterialPrepareRouteDiagnostic {
    readonly code: QueuedMaterialPrepareRouteDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly drawIndex: number;
    readonly materialFamily: string;
    readonly materialKind?: string;
    readonly materialKey: string;
    readonly entity?: {
        readonly index: number;
        readonly generation: number;
    };
}
export interface QueuedMaterialPrepareRouteContext<TMaterial = MaterialAsset> {
    readonly queueItem: MaterialQueueItem;
    readonly material: TMaterial;
    readonly sourceVersion: number;
    readonly frame: number;
}
export interface QueuedMaterialPrepareRouteResult<TDiagnostic = unknown> {
    readonly valid: boolean;
    readonly status: QueuedMaterialPrepareRouteStatus;
    readonly family: string;
    readonly materialKey: string;
    readonly meshResourceKey: string | null;
    readonly materialResourceKey: string | null;
    readonly pipelineKey: string;
    readonly sourceVersion: number;
    readonly frame: number;
    readonly diagnostics: readonly TDiagnostic[];
}
export interface QueuedMaterialPrepareRouteAdapter<Kind extends string = string, TMaterial = MaterialAsset, TDiagnostic = unknown> extends QueuedMaterialAdapterRegistration<Kind> {
    acceptsMaterial(material: unknown): material is TMaterial;
    validateQueueItem(queueItem: MaterialQueueItem): TDiagnostic | null;
    prepareRoute(context: QueuedMaterialPrepareRouteContext<TMaterial>): QueuedMaterialPrepareRouteResult<TDiagnostic>;
}
export type QueuedMaterialPrepareRouteAdapterDiagnostic<TAdapter> = TAdapter extends QueuedMaterialPrepareRouteAdapter<infer _Kind, infer _Material, infer TDiagnostic> ? TDiagnostic : never;
type QueuedMaterialPrepareRouteResultDiagnostic<TAdapter extends QueuedMaterialPrepareRouteAdapter<string, unknown, unknown>> = QueuedMaterialPrepareRouteDiagnostic | QueuedMaterialPrepareRouteAdapterDiagnostic<TAdapter>;
export declare function routeQueuedMaterialPrepare<TAdapter extends QueuedMaterialPrepareRouteAdapter<string, unknown, unknown>>(registry: QueuedMaterialAdapterRegistry<TAdapter>, context: QueuedMaterialPrepareRouteContext<unknown>): QueuedMaterialPrepareRouteResult<QueuedMaterialPrepareRouteResultDiagnostic<TAdapter>>;
export declare function createQueuedMaterialPrepareRouteResult<TDiagnostic = never>(context: QueuedMaterialPrepareRouteContext<unknown>, options?: {
    readonly valid?: boolean;
    readonly status?: QueuedMaterialPrepareRouteStatus;
    readonly diagnostics?: readonly TDiagnostic[];
}): QueuedMaterialPrepareRouteResult<TDiagnostic>;
export {};
//# sourceMappingURL=queued-material-prepare-route.d.ts.map