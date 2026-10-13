import type { DebugNormalMaterialAsset, MaterialAsset, MaterialQueueItem, MatcapMaterialAsset, StandardMaterialAsset, UnlitMaterialAsset } from "@aperture-engine/render";
import { type BuiltInMaterialQueueFamily } from "./built-in-material-queue-family.js";
import { type BuiltInMaterialQueuePhaseDiagnostic } from "./built-in-material-queue-phase.js";
import { type QueuedMaterialAdapterRegistration, type QueuedMaterialAdapterRegistry } from "../../render/queues/queued-material-adapter.js";
import { type QueuedMaterialPrepareRouteAdapter } from "../../render/queues/queued-material-prepare-route.js";
export type BuiltInMaterialAsset = UnlitMaterialAsset | MatcapMaterialAsset | StandardMaterialAsset | DebugNormalMaterialAsset;
export interface BuiltInMaterialQueueRouteAdapter extends QueuedMaterialAdapterRegistration<BuiltInMaterialQueueFamily>, QueuedMaterialPrepareRouteAdapter<BuiltInMaterialQueueFamily, BuiltInMaterialAsset, BuiltInMaterialQueuePhaseDiagnostic> {
    readonly kind: BuiltInMaterialQueueFamily;
    isMaterialAsset(material: MaterialAsset): material is BuiltInMaterialAsset;
    validateQueueItem(queueItem: MaterialQueueItem): BuiltInMaterialQueuePhaseDiagnostic | null;
}
export declare function createBuiltInMaterialQueueRouteAdapterRegistry(adapters?: readonly BuiltInMaterialQueueRouteAdapter[]): QueuedMaterialAdapterRegistry<BuiltInMaterialQueueRouteAdapter>;
export declare function createBuiltInMaterialQueueRouteAdapters(): readonly BuiltInMaterialQueueRouteAdapter[];
//# sourceMappingURL=built-in-material-queue-adapter.d.ts.map