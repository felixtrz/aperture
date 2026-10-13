import { type DiagnosticSummary } from "@aperture-engine/simulation";
import type { FrameBoundaryAssemblyReport } from "./frame-boundary.js";
export interface FrameBoundaryDiagnosticSummaryReport {
    readonly ready: boolean;
    readonly diagnostics: DiagnosticSummary;
}
export declare function summarizeFrameBoundaryDiagnostics(report: FrameBoundaryAssemblyReport): FrameBoundaryDiagnosticSummaryReport;
//# sourceMappingURL=frame-boundary-diagnostics.d.ts.map