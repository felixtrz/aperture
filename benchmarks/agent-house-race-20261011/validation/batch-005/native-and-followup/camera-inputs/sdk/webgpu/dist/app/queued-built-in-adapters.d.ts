import type { AssetRegistry } from "@aperture-engine/simulation";
import type { QueuedBuiltInAppResourceItem } from "../render/queues/queued-built-in-app-resource-set.js";
import type { QueuedBuiltInAppResourcePreparationCache, QueuedBuiltInFrameResourcePreparationOptions } from "./queued-frame-resources.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
interface QueuedBuiltInTextureSamplerPreparationOptions {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: QueuedBuiltInAppResourcePreparationCache;
    readonly item: QueuedBuiltInAppResourceItem;
    readonly reuse: WebGpuAppResourceReuseReport;
}
export declare const QUEUED_BUILT_IN_MATERIAL_ADAPTERS: import("../test-support.js").QueuedMaterialAdapterRegistry<import("../materials/core/built-in-material-app-resource-adapter.js").QueuedBuiltInAppResourceAdapter<QueuedBuiltInTextureSamplerPreparationOptions, QueuedBuiltInFrameResourcePreparationOptions>>;
export declare const QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION: import("../materials/core/built-in-material-app-resource-adapter.js").QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
export {};
//# sourceMappingURL=queued-built-in-adapters.d.ts.map