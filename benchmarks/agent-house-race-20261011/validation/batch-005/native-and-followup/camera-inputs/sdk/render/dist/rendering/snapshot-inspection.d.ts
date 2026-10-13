import type { RenderDiagnostic, RenderEntityRef, RenderSnapshot } from "./snapshot.js";
export interface RenderSnapshotInspectionCounts {
    readonly views: number;
    readonly meshDraws: number;
    readonly shadowCasterDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly shadowRequests: number;
    readonly proceduralSkies: number;
    readonly runtimeUniforms: number;
    readonly bounds: number;
    readonly transformFloats: number;
    readonly viewMatrixFloats: number;
    readonly diagnostics: number;
}
export interface RenderSnapshotInspectionHandles {
    readonly meshKeys: readonly string[];
    readonly materialKeys: readonly string[];
    readonly renderTargetKeys: readonly string[];
    readonly environmentMapKeys: readonly string[];
}
export interface RenderSnapshotInspectionReport {
    readonly counts: RenderSnapshotInspectionCounts;
    readonly handles: RenderSnapshotInspectionHandles;
    readonly diagnostics: readonly RenderDiagnostic[];
}
export type RenderSnapshotEntityExplanationStatus = "rendered" | "skipped" | "unknown";
export interface RenderSnapshotEntityExplanation {
    readonly entity: RenderEntityRef;
    readonly status: RenderSnapshotEntityExplanationStatus;
    readonly rendered: boolean;
    readonly skipped: boolean;
    readonly drawCount: number;
    readonly renderIds: readonly number[];
    readonly diagnosticCodes: readonly string[];
    readonly reasons: readonly string[];
}
export declare function inspectRenderSnapshot(snapshot: RenderSnapshot): RenderSnapshotInspectionReport;
export declare function explainRenderSnapshotEntity(snapshot: RenderSnapshot, entity: RenderEntityRef): RenderSnapshotEntityExplanation;
//# sourceMappingURL=snapshot-inspection.d.ts.map