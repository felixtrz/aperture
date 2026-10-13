import type { SimulationFixedStepCallback, SimulationFixedStepTaskOptions } from "@aperture-engine/runtime";
export interface FixedStepAccess {
    readonly available: boolean;
    register(task: SimulationFixedStepCallback, options?: SimulationFixedStepTaskOptions): () => void;
}
export type FixedStepTaskRegistrar = (task: SimulationFixedStepCallback, options?: SimulationFixedStepTaskOptions) => () => void;
export declare function createFixedStepAccess(registerTask?: FixedStepTaskRegistrar): FixedStepAccess;
//# sourceMappingURL=fixed-step.d.ts.map