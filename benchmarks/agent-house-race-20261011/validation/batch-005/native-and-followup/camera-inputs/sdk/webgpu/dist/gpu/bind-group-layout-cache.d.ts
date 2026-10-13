export type WebGpuBindGroupLayoutCacheFailureReason = "create-bind-group-layout-unavailable";
export type WebGpuBindGroupLayoutCacheStatus = "hit" | "miss";
export interface WebGpuBindGroupLayoutEntryDescriptor {
    readonly binding: number;
    readonly label?: string;
    readonly [key: string]: unknown;
}
export interface WebGpuBindGroupLayoutDescriptor {
    readonly label?: string;
    readonly entries: readonly WebGpuBindGroupLayoutEntryDescriptor[];
    readonly [key: string]: unknown;
}
export interface WebGpuBindGroupLayoutDeviceLike {
    createBindGroupLayout?: (descriptor: WebGpuBindGroupLayoutDescriptor) => unknown;
}
export interface WebGpuBindGroupLayoutCacheRequest {
    readonly device: WebGpuBindGroupLayoutDeviceLike;
    readonly descriptor: WebGpuBindGroupLayoutDescriptor;
}
export interface WebGpuBindGroupLayoutCacheSuccess {
    readonly ok: true;
    readonly status: WebGpuBindGroupLayoutCacheStatus;
    readonly key: string;
    readonly layout: unknown;
}
export interface WebGpuBindGroupLayoutCacheFailure {
    readonly ok: false;
    readonly reason: WebGpuBindGroupLayoutCacheFailureReason;
    readonly message: string;
    readonly key: string;
}
export type WebGpuBindGroupLayoutCacheResult = WebGpuBindGroupLayoutCacheSuccess | WebGpuBindGroupLayoutCacheFailure;
export declare class WebGpuBindGroupLayoutCache {
    #private;
    get size(): number;
    has(input: WebGpuBindGroupLayoutDescriptor | string): boolean;
    clear(): void;
    getOrCreate(request: WebGpuBindGroupLayoutCacheRequest): WebGpuBindGroupLayoutCacheResult;
}
export declare function createWebGpuBindGroupLayoutCacheKey(descriptor: WebGpuBindGroupLayoutDescriptor): string;
//# sourceMappingURL=bind-group-layout-cache.d.ts.map