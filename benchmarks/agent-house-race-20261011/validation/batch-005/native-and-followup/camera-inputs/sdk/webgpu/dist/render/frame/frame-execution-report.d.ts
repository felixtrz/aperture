import { type DiagnosticSeverity, type DiagnosticSummary } from "@aperture-engine/simulation";
import type { ClearCompatibilityReport } from "../clear/clear-compatibility.js";
import type { CommandSubmissionMetricsReport } from "../../gpu/command-submission-metrics.js";
import { type AssembleFrameBoundaryOptions, type FrameBoundaryAssemblyReport } from "./frame-boundary.js";
import { type FrameBoundaryDiagnosticSummaryReport } from "./frame-boundary-diagnostics.js";
import { type FrameBoundarySmokeReport } from "./frame-boundary-smoke.js";
import { type FrameBoundaryValidationReport } from "./frame-boundary-validation.js";
import { type FrameSubmissionSmokeReport } from "./frame-submission-smoke.js";
export type FrameExecutionSection = "boundarySmoke" | "clearCompatibility" | "diagnosticSummary" | "boundaryValidation" | "submissionSmoke" | "commandSubmissionMetrics";
export type FrameExecutionDiagnosticCode = "frameExecution.missingExecution" | "frameExecution.missingFinish" | "frameExecution.missingSubmit";
export interface FrameExecutionDiagnostic {
    readonly section: FrameExecutionSection;
    readonly code: string;
    readonly message: string;
    readonly severity: DiagnosticSeverity;
}
export interface FrameExecutionSectionStatus {
    readonly section: FrameExecutionSection;
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface FrameExecutionSections {
    readonly boundarySmoke: FrameExecutionSectionStatus;
    readonly clearCompatibility: FrameExecutionSectionStatus;
    readonly diagnosticSummary: FrameExecutionSectionStatus;
    readonly boundaryValidation: FrameExecutionSectionStatus;
    readonly submissionSmoke: FrameExecutionSectionStatus;
    readonly commandSubmissionMetrics: FrameExecutionSectionStatus;
}
export interface FrameExecutionCounts {
    readonly commands: number;
    readonly executedCommands: number;
    readonly skippedCommands: number;
    readonly drawCalls: number;
    readonly commandBuffers: number;
    readonly submittedCommandBuffers: number;
    readonly skippedSubmissions: number;
    readonly smokeDiagnostics: number;
    readonly compatibilityDiagnostics: number;
    readonly sourceDiagnostics: number;
    readonly validationDiagnostics: number;
    readonly submissionDiagnostics: number;
    readonly commandSubmissionDiagnostics: number;
    readonly diagnostics: number;
}
export interface FrameExecutionReport {
    readonly ready: boolean;
    readonly sections: FrameExecutionSections;
    readonly counts: FrameExecutionCounts;
    readonly reports: {
        readonly boundarySmoke: FrameBoundarySmokeReport;
        readonly clearCompatibility: ClearCompatibilityReport;
        readonly diagnosticSummary: FrameBoundaryDiagnosticSummaryReport;
        readonly boundaryValidation: FrameBoundaryValidationReport;
        readonly submissionSmoke: FrameSubmissionSmokeReport;
        readonly commandSubmissionMetrics: CommandSubmissionMetricsReport | null;
    };
    readonly diagnostics: readonly FrameExecutionDiagnostic[];
}
export interface FrameExecutionSectionJsonValue {
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface FrameExecutionSectionsJsonValue {
    readonly boundarySmoke: FrameExecutionSectionJsonValue;
    readonly clearCompatibility: FrameExecutionSectionJsonValue;
    readonly diagnosticSummary: FrameExecutionSectionJsonValue;
    readonly boundaryValidation: FrameExecutionSectionJsonValue;
    readonly submissionSmoke: FrameExecutionSectionJsonValue;
    readonly commandSubmissionMetrics: FrameExecutionSectionJsonValue;
}
export interface FrameExecutionReportJsonValue {
    readonly ready: boolean;
    readonly sections: FrameExecutionSectionsJsonValue;
    readonly counts: FrameExecutionCounts;
    readonly diagnostics: DiagnosticSummary;
}
export interface FrameExecutionSectionDiagnosticSummary {
    readonly section: FrameExecutionSection;
    readonly diagnostics: DiagnosticSummary;
}
export interface FrameExecutionDiagnosticGroups {
    readonly boundarySmoke: FrameExecutionSectionDiagnosticSummary;
    readonly clearCompatibility: FrameExecutionSectionDiagnosticSummary;
    readonly diagnosticSummary: FrameExecutionSectionDiagnosticSummary;
    readonly boundaryValidation: FrameExecutionSectionDiagnosticSummary;
    readonly submissionSmoke: FrameExecutionSectionDiagnosticSummary;
    readonly commandSubmissionMetrics: FrameExecutionSectionDiagnosticSummary;
}
export interface FrameExecutionDiagnosticGroupReport {
    readonly ready: boolean;
    readonly sections: FrameExecutionDiagnosticGroups;
    readonly diagnostics: DiagnosticSummary;
}
export interface InjectedFrameExecutionRunnerReport {
    readonly assembly: FrameBoundaryAssemblyReport;
    readonly execution: FrameExecutionReport;
}
export declare function createFrameExecutionReport(assembly: FrameBoundaryAssemblyReport): FrameExecutionReport;
export declare function runInjectedFrameExecution(options: AssembleFrameBoundaryOptions): InjectedFrameExecutionRunnerReport;
export declare function frameExecutionReportToJsonValue(report: FrameExecutionReport): FrameExecutionReportJsonValue;
export declare function frameExecutionReportToJson(report: FrameExecutionReport): string;
export declare function summarizeFrameExecutionDiagnosticsBySection(report: FrameExecutionReport): FrameExecutionDiagnosticGroupReport;
//# sourceMappingURL=frame-execution-report.d.ts.map