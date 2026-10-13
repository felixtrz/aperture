import type { DiagnosticSummary } from "@aperture-engine/simulation";
import type { FrameBoundaryDiagnosticSummaryReport } from "./frame-boundary-diagnostics.js";
export interface MergedFrameBoundaryDiagnosticSummaryReport {
    readonly ready: boolean;
    readonly reportCount: number;
    readonly diagnostics: DiagnosticSummary;
}
export declare function mergeFrameBoundaryDiagnosticSummaryReports(reports: readonly FrameBoundaryDiagnosticSummaryReport[]): MergedFrameBoundaryDiagnosticSummaryReport;
//# sourceMappingURL=frame-boundary-diagnostics-merge.d.ts.map