import type { RenderedGeometryFrameCapture } from "./rendered-geometry-inspector.js";
import { type AssetRegistry } from "@aperture-engine/simulation";
import { type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppRenderOptions, WebGpuAppRenderReport } from "./app.js";
interface WebGpuAppFrameRenderOptions extends WebGpuAppRenderOptions {
    readonly geometryFrame?: RenderedGeometryFrameCapture | undefined;
    readonly previousSnapshotForUpdate?: RenderSnapshot | null;
    readonly resourceLifetimeFrame?: number;
}
export declare function renderWebGpuAppFrame(context: {
    readonly app: WebGpuApp;
    readonly sourceAssets: AssetRegistry;
}, resourceCache: WebGpuAppResourceCache, options: WebGpuAppFrameRenderOptions): Promise<WebGpuAppRenderReport>;
export {};
//# sourceMappingURL=frame-loop.d.ts.map