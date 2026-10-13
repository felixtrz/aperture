import type { PreparedMaterialStore, PreparedMeshStore } from "../assets/preparation.js";
import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport } from "./render-world-prepared-resources.js";
import { type RenderWorldPreparedResourceSummary } from "./render-world-prepared-resource-summary.js";
import type { RenderDiagnostic } from "./snapshot.js";
export interface CreateRenderWorldPreparedResourceSummaryFromReportOptions {
    readonly meshes: PreparedMeshStore;
    readonly materials: PreparedMaterialStore;
    readonly report: PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport;
    readonly drawReadiness?: RenderWorldDrawReadinessReport;
    readonly diagnostics?: readonly RenderDiagnostic[];
}
export declare function createRenderWorldPreparedResourceSummaryFromReport(options: CreateRenderWorldPreparedResourceSummaryFromReportOptions): RenderWorldPreparedResourceSummary;
//# sourceMappingURL=render-world-prepared-resource-summary-from-report.d.ts.map