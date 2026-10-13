import type { EcsWorld } from "../ecs/index.js";
export type TransformDiagnosticCode = "stale-parent" | "missing-parent-transform" | "cycle" | "parent-unresolved";
export interface TransformDiagnostic {
    readonly code: TransformDiagnosticCode;
    readonly entity: number;
    readonly generation: number;
    readonly parent?: number;
    readonly parentGeneration?: number;
    readonly cycle?: readonly string[];
    readonly message: string;
}
export interface TransformResolutionReport {
    readonly resolved: number;
    readonly skipped: number;
    readonly diagnostics: readonly TransformDiagnostic[];
}
export declare function resolveWorldTransforms(world: EcsWorld): TransformResolutionReport;
//# sourceMappingURL=resolution.d.ts.map