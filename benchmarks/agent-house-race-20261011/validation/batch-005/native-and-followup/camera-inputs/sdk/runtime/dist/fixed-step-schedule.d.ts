import { type FixedStepClockOptions, type FixedStepClockState } from "@aperture-engine/physics";
import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
export interface SimulationFixedStepContext {
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
    readonly fixedDelta: number;
    readonly fixedStep: number;
    readonly substep: number;
    readonly substeps: number;
    readonly frameDelta: number;
    readonly frameTime: number;
    readonly fixedStartTime: number;
    readonly fixedEndTime: number;
    readonly frameOverstepAlpha: number;
}
export type SimulationFixedStepCallback = (context: SimulationFixedStepContext) => void;
export interface SimulationFixedStepTaskOptions {
    readonly priority?: number;
}
export interface SimulationFixedStepOptions extends FixedStepClockOptions {
    readonly enabled?: boolean;
    readonly update?: SimulationFixedStepCallback;
}
export interface SimulationFixedStepFrameReport {
    readonly enabled: boolean;
    readonly substeps: number;
    readonly fixedDelta: number;
    readonly fixedStepStart: number;
    readonly fixedStepEnd: number;
    readonly overstepAlpha: number;
    readonly consumedTime: number;
    readonly droppedTime: number;
    readonly clamped: boolean;
}
export type SimulationFixedStepClockState = FixedStepClockState;
export interface SimulationFixedStepRunner {
    readonly enabled: boolean;
    registerTask(task: SimulationFixedStepCallback, options?: SimulationFixedStepTaskOptions): () => void;
    step(delta: number, time: number): SimulationFixedStepFrameReport;
    reset(): void;
    snapshot(): SimulationFixedStepClockState | null;
    restore(state: SimulationFixedStepClockState | null): boolean;
}
interface SimulationFixedStepRunnerContext {
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
}
export declare function createSimulationFixedStepRunner(options: SimulationFixedStepOptions | false | undefined, context: SimulationFixedStepRunnerContext): SimulationFixedStepRunner;
export {};
//# sourceMappingURL=fixed-step-schedule.d.ts.map