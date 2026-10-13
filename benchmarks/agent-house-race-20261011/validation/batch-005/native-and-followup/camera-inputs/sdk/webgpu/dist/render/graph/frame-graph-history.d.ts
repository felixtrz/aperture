export interface FrameGraphHistoryResource<T> {
    /** This frame's write target (the 'current' view). */
    current(): T;
    /** Last frame's written buffer (the 'previous' view). Distinct from current(). */
    previous(): T;
    /** True once at least one frame has been swapped (previous() carries real data). */
    hasPrevious(): boolean;
    /** Advance one frame: this frame's write becomes next frame's previous. */
    swap(): void;
    /** Number of frames swapped (for resource-stability assertions). */
    readonly swapCount: number;
    /** The two backing buffers, in fixed order (pool size is always 2). */
    readonly buffers: readonly [T, T];
}
export declare function createFrameGraphHistoryResource<T>(bufferA: T, bufferB: T): FrameGraphHistoryResource<T>;
//# sourceMappingURL=frame-graph-history.d.ts.map