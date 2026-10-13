import type { RenderSnapshot } from "./snapshot.js";
export type RenderSnapshotCloneDiagnosticCode = "renderSnapshotClone.invalidTransformBuffer" | "renderSnapshotClone.invalidViewMatrixBuffer" | "renderSnapshotClone.cloneFailed";
export interface RenderSnapshotCloneDiagnostic {
    readonly code: RenderSnapshotCloneDiagnosticCode;
    readonly message: string;
}
export interface RenderSnapshotCloneabilityResult {
    readonly valid: boolean;
    readonly diagnostics: readonly RenderSnapshotCloneDiagnostic[];
}
export interface RenderSnapshotCloneabilityOptions {
    readonly clone?: (value: RenderSnapshot) => unknown;
}
export declare function validateRenderSnapshotCloneability(snapshot: RenderSnapshot, options?: RenderSnapshotCloneabilityOptions): RenderSnapshotCloneabilityResult;
//# sourceMappingURL=snapshot-clone.d.ts.map