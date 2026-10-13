import type { RenderSnapshot } from "@aperture-engine/render";
import { type EcsWorld } from "@aperture-engine/simulation";
export interface PhysicsSnapshotInterpolationReport {
    readonly enabled: boolean;
    readonly alpha: number;
    readonly transformWrites: number;
    readonly boundsWrites: number;
}
export declare function applyPhysicsSnapshotInterpolation(options: {
    readonly snapshot: RenderSnapshot;
    readonly world: EcsWorld;
    readonly alpha: number;
}): PhysicsSnapshotInterpolationReport;
//# sourceMappingURL=physics-interpolation.d.ts.map