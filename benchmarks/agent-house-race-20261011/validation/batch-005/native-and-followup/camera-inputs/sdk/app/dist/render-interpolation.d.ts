import type { RenderSnapshot } from "@aperture-engine/render";
import { type EcsWorld } from "@aperture-engine/simulation";
import type { FixedStepTaskRegistrar } from "./systems/fixed-step.js";
export declare const RENDER_INTERPOLATION_PRE_PRIORITY = -1000000000;
export declare const RENDER_INTERPOLATION_POST_PRIORITY = 1000000000;
export interface RenderSnapshotInterpolationReport {
    readonly enabled: boolean;
    readonly alpha: number;
    readonly transformWrites: number;
    readonly boundsWrites: number;
    readonly viewWrites: number;
}
export declare function installRenderInterpolationFixedStep(options: {
    readonly world: EcsWorld;
    readonly registerFixedStepTask: FixedStepTaskRegistrar;
}): () => void;
export declare function prepareRenderInterpolationFixedStep(world: EcsWorld): void;
export declare function commitRenderInterpolationFixedStep(world: EcsWorld): void;
export declare function applyRenderSnapshotInterpolation(options: {
    readonly snapshot: RenderSnapshot;
    readonly world: EcsWorld;
    readonly alpha: number;
}): RenderSnapshotInterpolationReport;
//# sourceMappingURL=render-interpolation.d.ts.map