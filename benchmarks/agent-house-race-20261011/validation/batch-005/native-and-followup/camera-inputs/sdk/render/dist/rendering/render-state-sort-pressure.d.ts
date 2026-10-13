import type { OpaqueRenderStateSortPressureReport, RenderStateSortRecord, RenderStateSwitchCounts } from "./render-state-sort-types.js";
export declare function createOpaqueRenderStateSortPressureReport(input: {
    readonly stableOrder: RenderStateSwitchCounts;
    readonly stateAwareOrder: RenderStateSwitchCounts;
    readonly recordCount: number;
}): OpaqueRenderStateSortPressureReport;
export declare function emptyOpaqueRenderStateSortPressureReport(): OpaqueRenderStateSortPressureReport;
export declare function countOpaqueRenderStateSwitches(records: readonly RenderStateSortRecord[]): RenderStateSwitchCounts;
export declare function countOpaqueRenderStateRecords(records: readonly RenderStateSortRecord[]): number;
//# sourceMappingURL=render-state-sort-pressure.d.ts.map