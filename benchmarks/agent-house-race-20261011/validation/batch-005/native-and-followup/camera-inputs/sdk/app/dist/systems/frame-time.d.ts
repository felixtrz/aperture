export interface ApertureFrameTime {
    /** Seconds advanced by the current step. */
    readonly delta: number;
    /** Caller-supplied simulation time (seconds) at the current step. */
    readonly elapsed: number;
    /** Number of steps taken (increments by 1 per step). */
    readonly frame: number;
}
export interface ApertureFrameTimeState {
    readonly delta: number;
    readonly elapsed: number;
    readonly frame: number;
}
export declare function createApertureFrameTime(): ApertureFrameTime;
export declare function advanceApertureFrameTime(time: ApertureFrameTime, delta: number, elapsed: number): void;
export declare function resetApertureFrameTime(time: ApertureFrameTime): void;
export declare function snapshotApertureFrameTime(time: ApertureFrameTime): ApertureFrameTimeState;
export declare function restoreApertureFrameTime(time: ApertureFrameTime, state: ApertureFrameTimeState): void;
//# sourceMappingURL=frame-time.d.ts.map