export interface FixedStepClockOptions {
    readonly fixedDelta?: number;
    readonly maxSubsteps?: number;
    readonly maxAccumulatedTime?: number;
}
export interface FixedStepClock {
    readonly fixedDelta: number;
    readonly maxSubsteps: number;
    readonly maxAccumulatedTime: number;
    accumulator: number;
    fixedStepIndex: number;
    overstepAlpha: number;
    droppedTime: number;
}
export interface FixedStepClockState {
    readonly fixedDelta: number;
    readonly maxSubsteps: number;
    readonly maxAccumulatedTime: number;
    readonly accumulator: number;
    readonly fixedStepIndex: number;
    readonly overstepAlpha: number;
    readonly droppedTime: number;
}
export interface FixedStepAdvanceResult {
    readonly substeps: number;
    readonly fixedDelta: number;
    readonly fixedStepStart: number;
    readonly fixedStepEnd: number;
    readonly overstepAlpha: number;
    readonly consumedTime: number;
    readonly droppedTime: number;
    readonly clamped: boolean;
}
export declare function createFixedStepClock(options?: FixedStepClockOptions): FixedStepClock;
export declare function advanceFixedStepClock(clock: FixedStepClock, delta: number): FixedStepAdvanceResult;
export declare function resetFixedStepClock(clock: FixedStepClock): void;
export declare function snapshotFixedStepClock(clock: FixedStepClock): FixedStepClockState;
export declare function restoreFixedStepClock(clock: FixedStepClock, state: FixedStepClockState): void;
//# sourceMappingURL=fixed-step.d.ts.map