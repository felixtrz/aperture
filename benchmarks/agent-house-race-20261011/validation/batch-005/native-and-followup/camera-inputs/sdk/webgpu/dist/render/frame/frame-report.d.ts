import { type DiagnosticSummary } from "@aperture-engine/simulation";
import type { DrawPackageBatchingReport } from "@aperture-engine/render";
import type { FrameAssemblyReadinessReport } from "./frame-readiness.js";
import type { RenderResourceSummaryReport } from "../../resources/core/resource-summary.js";
export interface FrameReportInput {
    readonly frame: number;
    readonly readiness: FrameAssemblyReadinessReport;
    readonly resources: RenderResourceSummaryReport;
    readonly batching: DrawPackageBatchingReport;
}
export interface FrameReport {
    readonly frame: number;
    readonly ready: boolean;
    readonly draws: number;
    readonly batches: number;
    readonly resources: RenderResourceSummaryReport["counts"];
    readonly diagnostics: DiagnosticSummary;
}
export interface FrameReportJsonValue {
    readonly frame: number;
    readonly ready: boolean;
    readonly draws: number;
    readonly batches: number;
    readonly resources: FrameReport["resources"];
    readonly diagnostics: DiagnosticSummary;
}
export declare function createFrameReport(input: FrameReportInput): FrameReport;
export declare function frameReportToJsonValue(report: FrameReport): FrameReportJsonValue;
export declare function frameReportToJson(report: FrameReport): string;
//# sourceMappingURL=frame-report.d.ts.map