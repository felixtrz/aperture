import type { FinishCommandEncoderResult } from "./command-buffer.js";
import type { SubmitCommandBuffersReport } from "../render/queues/queue-submit.js";
import type { RenderPassCommandExecutionReport } from "../render/passes/render-pass-command-executor.js";
import { type DiagnosticSummary } from "@aperture-engine/simulation";
export type CommandSubmissionMetricsDiagnosticCode = "commandSubmissionMetrics.executionFailed" | "commandSubmissionMetrics.finishFailed" | "commandSubmissionMetrics.submitFailed";
export interface CommandSubmissionMetricsDiagnostic {
    readonly code: CommandSubmissionMetricsDiagnosticCode;
    readonly message: string;
}
export interface CommandSubmissionMetricsReport {
    readonly ready: boolean;
    readonly counts: {
        readonly commands: number;
        readonly executedCommands: number;
        readonly skippedCommands: number;
        readonly drawCalls: number;
        readonly commandBuffers: number;
        readonly submittedCommandBuffers: number;
        readonly skippedSubmissions: number;
    };
    readonly diagnostics: readonly CommandSubmissionMetricsDiagnostic[];
}
export interface CommandSubmissionMetricsReportJsonValue {
    readonly ready: boolean;
    readonly counts: CommandSubmissionMetricsReport["counts"];
    readonly diagnostics: DiagnosticSummary;
}
export declare function createCommandSubmissionMetricsReport(input: {
    readonly execution: RenderPassCommandExecutionReport;
    readonly finish: FinishCommandEncoderResult;
    readonly submit: SubmitCommandBuffersReport;
}): CommandSubmissionMetricsReport;
/**
 * An execution report shaped enough for metric aggregation — both
 * RenderPassCommandExecutionReport (has drawCalls) and
 * ComputePassCommandExecutionReport (no drawCalls) satisfy it.
 */
export interface CommandSubmissionExecutionLike {
    readonly valid: boolean;
    readonly commandCount: number;
    readonly executedCommands: number;
    readonly skippedCommands: number;
    readonly drawCalls?: number;
}
/**
 * Aggregate metrics for a single command buffer assembled from MANY passes
 * (the FrameGraph single-encoder path): commands/executedCommands/drawCalls sum
 * across all render + compute node executions, while commandBuffers/submitted
 * reflect the one finish + one submit of the shared encoder.
 */
export declare function createMultiPassCommandSubmissionMetricsReport(input: {
    readonly executions: readonly CommandSubmissionExecutionLike[];
    readonly finish: FinishCommandEncoderResult;
    readonly submit: SubmitCommandBuffersReport;
}): CommandSubmissionMetricsReport;
export declare function commandSubmissionMetricsReportToJsonValue(report: CommandSubmissionMetricsReport): CommandSubmissionMetricsReportJsonValue;
export declare function commandSubmissionMetricsReportToJson(report: CommandSubmissionMetricsReport): string;
//# sourceMappingURL=command-submission-metrics.d.ts.map