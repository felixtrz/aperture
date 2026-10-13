import { type AssetRegistry } from "@aperture-engine/simulation";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import { type PrepareQueuedBuiltInFrameResourcesOptions } from "./queued-frame-resources.js";
import { collectQueuedBuiltInAppResourceSet, type QueuedBuiltInAppResourceItem } from "../render/queues/queued-built-in-app-resource-set.js";
import type { WebGpuApp, WebGpuAppPickReport, WebGpuAppPipelineResourceResult, WebGpuAppRenderReport, WebGpuAppResourceReuseReport } from "./app.js";
interface WebGpuAppPickContext {
    readonly app: WebGpuApp;
    readonly sourceAssets: AssetRegistry;
}
export interface WebGpuAppPickFrameOptions {
    readonly adapters: Parameters<typeof collectQueuedBuiltInAppResourceSet>[0]["adapters"];
    readonly resourceLifetimeFrame?: number;
    getPipeline(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly reuse: WebGpuAppResourceReuseReport;
    }): Promise<WebGpuAppPipelineResourceResult> | WebGpuAppPipelineResourceResult;
    getPipelineLayouts(input: Parameters<PrepareQueuedBuiltInFrameResourcesOptions["getPipelineLayouts"]>[0]): WebGpuAppPipelineLayouts;
}
export declare function pickWebGpuAppEntity(context: WebGpuAppPickContext, resourceCache: WebGpuAppResourceCache, latestReport: WebGpuAppRenderReport | null, x: number, y: number, options: WebGpuAppPickFrameOptions): Promise<WebGpuAppPickReport>;
export {};
//# sourceMappingURL=picking-frame.d.ts.map