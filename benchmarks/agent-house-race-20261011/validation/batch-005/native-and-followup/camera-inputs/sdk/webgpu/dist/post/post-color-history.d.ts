import { type FrameGraphHistoryResource } from "../render/graph/frame-graph-history.js";
import { type WebGpuPostPassDeviceLike, type WebGpuPostPassDiagnostic, type WebGpuPostPassTextureCacheSlot, type WebGpuPostPassTextureResource } from "./post-pass.js";
export interface WebGpuAppPostPassColorHistory {
    /** The double-buffered pool: current() writes, previous() reads, swap() once/frame. */
    readonly pool: FrameGraphHistoryResource<WebGpuPostPassTextureResource>;
    readonly width: number;
    readonly height: number;
    readonly format: string;
}
export interface WebGpuAppPostPassColorHistorySlot {
    current: WebGpuAppPostPassColorHistory | null;
    readonly bufferA: WebGpuPostPassTextureCacheSlot;
    readonly bufferB: WebGpuPostPassTextureCacheSlot;
}
export declare function createWebGpuAppPostPassColorHistorySlot(): WebGpuAppPostPassColorHistorySlot;
export interface ResolveWebGpuAppPostPassColorHistoryResult {
    readonly history: WebGpuAppPostPassColorHistory | null;
    /** True when this call (re)allocated the pool (first frame or resize). */
    readonly resized: boolean;
    readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
}
/**
 * Resolve (and lazily allocate / resize) the double-buffered color-history pool
 * for the given target dimensions and format. Returns the existing pool when the
 * descriptor is unchanged (history persists across frames); reallocates both
 * buffers and recreates the pool — dropping stale history — when width/height/
 * format changes.
 */
export declare function resolveWebGpuAppPostPassColorHistory(options: {
    readonly device: WebGpuPostPassDeviceLike;
    readonly slot: WebGpuAppPostPassColorHistorySlot;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly label: string;
}): ResolveWebGpuAppPostPassColorHistoryResult;
//# sourceMappingURL=post-color-history.d.ts.map