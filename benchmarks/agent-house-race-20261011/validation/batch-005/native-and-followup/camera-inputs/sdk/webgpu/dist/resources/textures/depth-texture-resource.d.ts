export declare const WEBGPU_APP_DEPTH_FORMAT = "depth24plus";
interface WebGpuDepthTextureLike {
    createView(): unknown;
    destroy?(): void;
}
interface WebGpuDepthTextureDeviceLike {
    createTexture(descriptor: {
        readonly label?: string;
        readonly size: readonly [number, number, number];
        readonly format: string;
        readonly sampleCount?: number;
        readonly usage: number;
    }): WebGpuDepthTextureLike;
}
export interface CachedWebGpuDepthTextureResource {
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly sampleCount: number;
    readonly texture: WebGpuDepthTextureLike;
    readonly view: unknown;
}
export interface WebGpuDepthTextureCacheSlot {
    current: CachedWebGpuDepthTextureResource | null;
}
export interface CreateOrReuseWebGpuDepthTextureOptions {
    readonly device: WebGpuDepthTextureDeviceLike;
    readonly cache: WebGpuDepthTextureCacheSlot;
    readonly width: number;
    readonly height: number;
    readonly format?: string;
    readonly sampleCount?: number;
    readonly label?: string;
}
export interface CreateOrReuseWebGpuDepthTextureResult {
    readonly status: "created" | "reused";
    readonly resource: CachedWebGpuDepthTextureResource;
}
export declare function createWebGpuDepthTextureCacheSlot(): WebGpuDepthTextureCacheSlot;
export declare function createOrReuseWebGpuDepthTexture(options: CreateOrReuseWebGpuDepthTextureOptions): CreateOrReuseWebGpuDepthTextureResult;
export {};
//# sourceMappingURL=depth-texture-resource.d.ts.map