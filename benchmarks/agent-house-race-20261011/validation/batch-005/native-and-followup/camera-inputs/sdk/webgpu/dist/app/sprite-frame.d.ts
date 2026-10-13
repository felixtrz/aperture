import type { RenderedGeometryFrameCapture } from "./rendered-geometry-inspector.js";
import type { AssetRegistry } from "@aperture-engine/simulation";
import { type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppRenderOptions, WebGpuAppRenderReport } from "./app.js";
export declare function renderSpriteOnlyWebGpuAppFrame(context: {
    readonly app: WebGpuApp;
    readonly sourceAssets: AssetRegistry;
}, resourceCache: WebGpuAppResourceCache, options: WebGpuAppRenderOptions & {
    readonly snapshot: RenderSnapshot;
    readonly geometryFrame?: RenderedGeometryFrameCapture | undefined;
}): Promise<WebGpuAppRenderReport>;
//# sourceMappingURL=sprite-frame.d.ts.map