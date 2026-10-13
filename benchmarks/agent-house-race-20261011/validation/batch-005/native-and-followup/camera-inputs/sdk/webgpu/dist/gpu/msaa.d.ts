import type { CurrentTextureLike } from "../app/presentation/current-texture-view.js";
export type WebGpuMsaaSampleCount = 1 | 4;
export interface WebGpuMsaaConfig {
    readonly requestedSampleCount: number;
    readonly sampleCount: WebGpuMsaaSampleCount;
    readonly enabled: boolean;
    readonly clamped: boolean;
    readonly supportedSampleCounts: readonly WebGpuMsaaSampleCount[];
}
export type WebGpuMsaaColorTextureDiagnosticCode = "webGpuMsaaColorTexture.createTextureUnavailable" | "webGpuMsaaColorTexture.textureCreationFailed" | "webGpuMsaaColorTexture.textureViewCreationFailed";
export interface WebGpuMsaaColorTextureDiagnostic {
    readonly code: WebGpuMsaaColorTextureDiagnosticCode;
    readonly message: string;
}
export interface WebGpuMsaaTextureLike extends CurrentTextureLike {
    destroy?: () => void;
}
export interface WebGpuMsaaTextureDeviceLike {
    createTexture?: (descriptor: unknown) => WebGpuMsaaTextureLike;
}
export interface CachedWebGpuMsaaColorTextureResource {
    readonly texture: WebGpuMsaaTextureLike;
    readonly view: unknown;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly sampleCount: WebGpuMsaaSampleCount;
    readonly label: string;
}
export interface WebGpuMsaaColorTextureCacheSlot {
    current: CachedWebGpuMsaaColorTextureResource | null;
}
export interface CreateOrReuseWebGpuMsaaColorTextureResult {
    readonly valid: boolean;
    readonly status: "created" | "reused" | "disabled" | "failed";
    readonly resource: CachedWebGpuMsaaColorTextureResource | null;
    readonly diagnostics: readonly WebGpuMsaaColorTextureDiagnostic[];
}
export declare function resolveWebGpuMsaaConfig(requestedSampleCount: number | undefined): WebGpuMsaaConfig;
export declare function createWebGpuMsaaColorTextureCacheSlot(): WebGpuMsaaColorTextureCacheSlot;
export declare function createOrReuseWebGpuMsaaColorTexture(options: {
    readonly device: WebGpuMsaaTextureDeviceLike;
    readonly cache: WebGpuMsaaColorTextureCacheSlot;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly sampleCount: WebGpuMsaaSampleCount;
    readonly label: string;
}): CreateOrReuseWebGpuMsaaColorTextureResult;
//# sourceMappingURL=msaa.d.ts.map