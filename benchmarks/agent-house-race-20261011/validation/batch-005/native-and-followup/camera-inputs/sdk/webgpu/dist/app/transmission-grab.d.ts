import { type AssetRegistry } from "@aperture-engine/simulation";
import { type RenderSnapshot } from "@aperture-engine/render";
import type { StandardFrameTransmissionSceneColorResources } from "../materials/standard/standard-frame-resources.js";
import { assembleFrameBoundary, type FrameBoundaryAssemblyReport } from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { type WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppTransmissionGrabPassReport } from "./app.js";
interface WebGpuAppTransmissionGrabContext {
    readonly canvas: WebGpuCanvasLike;
    readonly initialization: {
        readonly context: unknown;
        readonly device: unknown;
        readonly format: string;
    };
}
export interface WebGpuAppTransmissionGrabResourcesResult {
    readonly valid: boolean;
    readonly resources: StandardFrameTransmissionSceneColorResources | null;
    readonly diagnostics: readonly unknown[];
}
export declare function createWebGpuAppTransmissionGrabResources(options: {
    readonly app: WebGpuAppTransmissionGrabContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly required: boolean;
}): WebGpuAppTransmissionGrabResourcesResult;
export interface WebGpuAppTransmissionGrabPassOptions {
    readonly app: WebGpuAppTransmissionGrabContext;
    readonly target: WebGpuAppFrameBoundaryTarget;
    readonly commands: readonly RenderPassCommand[];
    readonly depthAttachment: CachedWebGpuDepthTextureResource;
    readonly label: string;
    readonly clearColor: readonly number[];
    readonly resources: StandardFrameTransmissionSceneColorResources;
}
export declare function buildWebGpuAppTransmissionGrabBoundaryOptions(options: WebGpuAppTransmissionGrabPassOptions): {
    readonly boundaryOptions: Parameters<typeof assembleFrameBoundary>[0];
    readonly reportBase: Omit<WebGpuAppTransmissionGrabPassReport, "ok">;
};
export declare function assembleWebGpuAppTransmissionGrabPass(options: WebGpuAppTransmissionGrabPassOptions): {
    readonly boundary: FrameBoundaryAssemblyReport;
    readonly report: WebGpuAppTransmissionGrabPassReport;
    readonly diagnostics: readonly unknown[];
};
export {};
//# sourceMappingURL=transmission-grab.d.ts.map