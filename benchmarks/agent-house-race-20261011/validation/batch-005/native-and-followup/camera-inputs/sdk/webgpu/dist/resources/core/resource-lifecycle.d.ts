export declare const RENDER_RESOURCE_LIFECYCLE_KINDS: readonly ["mesh", "material", "view", "shader", "pipeline"];
export type RenderResourceLifecycleKind = (typeof RENDER_RESOURCE_LIFECYCLE_KINDS)[number];
export interface RenderResourceLifecycleKeySets {
    readonly mesh: ReadonlySet<string>;
    readonly material: ReadonlySet<string>;
    readonly view: ReadonlySet<string>;
    readonly shader: ReadonlySet<string>;
    readonly pipeline: ReadonlySet<string>;
}
export interface RenderResourceLifecycleInput {
    readonly previous: RenderResourceLifecycleKeySets;
    readonly next: RenderResourceLifecycleKeySets;
}
export interface RenderResourceLifecycleChangeSet {
    readonly retained: readonly string[];
    readonly created: readonly string[];
    readonly removed: readonly string[];
}
export type RenderResourceLifecycleChangesByKind = {
    readonly [Kind in RenderResourceLifecycleKind]: RenderResourceLifecycleChangeSet;
};
export interface RenderResourceLifecycleCounts {
    readonly retained: number;
    readonly created: number;
    readonly removed: number;
}
export interface RenderResourceLifecycleReport {
    readonly byKind: RenderResourceLifecycleChangesByKind;
    readonly totals: RenderResourceLifecycleCounts;
    readonly hasChanges: boolean;
}
export type RenderResourceInspectionStatus = "live" | "missing" | "stale" | "pending-destroy";
export interface RenderResourceInspectionRecord {
    readonly kind: RenderResourceLifecycleKind;
    readonly resourceKey: string;
    readonly assetKey?: string;
    readonly version?: number | string;
    readonly expectedVersion?: number | string;
    readonly status: RenderResourceInspectionStatus;
    readonly pendingDestroy: boolean;
}
export interface RenderResourceInspectionCounts {
    readonly total: number;
    readonly live: number;
    readonly missing: number;
    readonly stale: number;
    readonly pendingDestroy: number;
}
export type RenderResourceInspectionDiagnosticCode = "renderResourceInspection.missingResource" | "renderResourceInspection.staleResource" | "renderResourceInspection.pendingDestroy";
export interface RenderResourceInspectionDiagnostic {
    readonly code: RenderResourceInspectionDiagnosticCode;
    readonly message: string;
    readonly resourceKey: string;
    readonly assetKey?: string;
    readonly kind: RenderResourceLifecycleKind;
    readonly status: RenderResourceInspectionStatus;
}
export interface RenderResourceInspectionReport {
    readonly records: readonly RenderResourceInspectionRecord[];
    readonly counts: RenderResourceInspectionCounts;
    readonly diagnostics: readonly RenderResourceInspectionDiagnostic[];
}
export declare function createRenderResourceLifecycleReport(input: RenderResourceLifecycleInput): RenderResourceLifecycleReport;
export declare function createRenderResourceInspectionReport(records: readonly RenderResourceInspectionRecord[]): RenderResourceInspectionReport;
//# sourceMappingURL=resource-lifecycle.d.ts.map