import { type CachedWebGpuMsaaColorTextureResource, type WebGpuMsaaConfig } from "../gpu/msaa.js";
import { type CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
interface WebGpuAppAttachmentContext {
    readonly initialization: {
        readonly device: unknown;
    };
    readonly msaa: Pick<WebGpuMsaaConfig, "sampleCount">;
    readonly sceneRenderFormat: string;
}
export interface WebGpuAppMsaaReport {
    readonly requestedSampleCount: number;
    readonly sampleCount: number;
    readonly enabled: boolean;
    readonly clamped: boolean;
    readonly supportedSampleCounts: readonly number[];
    readonly colorTargets: number;
    readonly colorTexturesCreated: number;
    readonly colorTexturesReused: number;
}
export interface WebGpuAppMsaaColorTargetResult {
    readonly valid: boolean;
    readonly status: "created" | "reused" | "disabled" | "failed";
    readonly resource: CachedWebGpuMsaaColorTextureResource | null;
    readonly diagnostics: readonly unknown[];
}
export declare function createWebGpuAppDepthAttachmentForTarget(app: WebGpuAppAttachmentContext, resourceCache: WebGpuAppResourceCache, target: WebGpuAppFrameBoundaryTarget): CachedWebGpuDepthTextureResource;
export declare function createWebGpuAppMsaaColorTargetForTarget(app: WebGpuAppAttachmentContext, resourceCache: WebGpuAppResourceCache, target: WebGpuAppFrameBoundaryTarget): WebGpuAppMsaaColorTargetResult;
export declare function createWebGpuAppMsaaReport(input: {
    readonly config: WebGpuMsaaConfig;
    readonly colorTargets: number;
    readonly colorTexturesCreated: number;
    readonly colorTexturesReused: number;
}): WebGpuAppMsaaReport;
export {};
//# sourceMappingURL=attachments.d.ts.map