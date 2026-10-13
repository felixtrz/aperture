import type { MeshTopology } from "@aperture-engine/render";
import type { BatchCompatibilityKey } from "@aperture-engine/render";
export type WebGpuRenderPipelineCacheFailureReason = "create-render-pipeline-unavailable";
export type WebGpuRenderPipelineCacheStatus = "hit" | "miss";
export interface WebGpuRenderPipelinePrimitiveStateKey {
    readonly topology?: MeshTopology;
    readonly cullMode?: string;
    readonly frontFace?: string;
    readonly stripIndexFormat?: string | null;
}
export interface WebGpuRenderPipelineDepthStencilStateKey {
    readonly format?: string | null;
    readonly depthWriteEnabled?: boolean;
    readonly depthCompare?: string;
    readonly depthBias?: number;
    readonly depthBiasSlopeScale?: number;
    readonly stencilReadMask?: number;
    readonly stencilWriteMask?: number;
}
export interface WebGpuRenderPipelineColorTargetStateKey {
    readonly format?: string;
    readonly blend?: unknown;
    readonly writeMask?: string | number;
}
export interface WebGpuRenderPipelineBlendStateKey {
    readonly alphaToCoverageEnabled?: boolean;
    readonly colorTargets?: readonly WebGpuRenderPipelineColorTargetStateKey[];
}
export interface WebGpuRenderPipelineCacheKeyInput {
    readonly shaderLabel: string;
    readonly shaderFamily?: string;
    readonly shaderVariantKey?: string;
    readonly colorFormats: readonly string[];
    readonly depthFormat?: string | null;
    readonly stencilFormat?: string | null;
    readonly topology?: MeshTopology;
    readonly vertexLayoutKey?: string;
    readonly bindGroupLayoutKeys?: readonly string[];
    readonly primitive?: WebGpuRenderPipelinePrimitiveStateKey;
    readonly depthStencil?: WebGpuRenderPipelineDepthStencilStateKey;
    readonly blend?: WebGpuRenderPipelineBlendStateKey;
    readonly sampleCount?: number;
    readonly materialPipelineKey?: string;
    readonly materialVariantKey?: string;
    readonly batchKey: BatchCompatibilityKey;
}
export interface WebGpuRenderPipelineCreateDescriptor {
    readonly label?: string;
    readonly [key: string]: unknown;
}
export interface WebGpuRenderPipelineDeviceLike {
    createRenderPipeline?: (descriptor: WebGpuRenderPipelineCreateDescriptor) => unknown;
}
export interface WebGpuRenderPipelineCacheRequest {
    readonly device: WebGpuRenderPipelineDeviceLike;
    readonly key: WebGpuRenderPipelineCacheKeyInput;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface WebGpuRenderPipelineCacheSuccess {
    readonly ok: true;
    readonly status: WebGpuRenderPipelineCacheStatus;
    readonly key: string;
    readonly pipeline: unknown;
}
export interface WebGpuRenderPipelineCacheFailure {
    readonly ok: false;
    readonly reason: WebGpuRenderPipelineCacheFailureReason;
    readonly message: string;
    readonly key: string;
}
export type WebGpuRenderPipelineCacheResult = WebGpuRenderPipelineCacheSuccess | WebGpuRenderPipelineCacheFailure;
export declare class WebGpuRenderPipelineCache {
    #private;
    get size(): number;
    has(input: WebGpuRenderPipelineCacheKeyInput | string): boolean;
    clear(): void;
    getOrCreate(request: WebGpuRenderPipelineCacheRequest): WebGpuRenderPipelineCacheResult;
}
export declare function createWebGpuRenderPipelineCacheKey(input: WebGpuRenderPipelineCacheKeyInput): string;
//# sourceMappingURL=pipeline-cache.d.ts.map