import type { FinishCommandEncoderResult } from "./command-buffer.js";
import type { SubmitCommandBuffersReport } from "./queue-submit.js";
import type { RenderPassCommandExecutionReport } from "./render-pass-command-executor.js";
import {
  summarizeDiagnostics,
  type DiagnosticSummary,
} from "@aperture-engine/simulation";

export type CommandSubmissionMetricsDiagnosticCode =
  | "commandSubmissionMetrics.executionFailed"
  | "commandSubmissionMetrics.finishFailed"
  | "commandSubmissionMetrics.submitFailed";

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

export function createCommandSubmissionMetricsReport(input: {
  readonly execution: RenderPassCommandExecutionReport;
  readonly finish: FinishCommandEncoderResult;
  readonly submit: SubmitCommandBuffersReport;
}): CommandSubmissionMetricsReport {
  const diagnostics: CommandSubmissionMetricsDiagnostic[] = [];

  if (!input.execution.valid) {
    diagnostics.push({
      code: "commandSubmissionMetrics.executionFailed",
      message: "Render pass command execution failed.",
    });
  }

  if (!input.finish.valid) {
    diagnostics.push({
      code: "commandSubmissionMetrics.finishFailed",
      message: "Command encoder finish failed.",
    });
  }

  if (!input.submit.valid) {
    diagnostics.push({
      code: "commandSubmissionMetrics.submitFailed",
      message: "Queue submission failed.",
    });
  }

  return {
    ready: diagnostics.length === 0,
    counts: {
      commands: input.execution.commandCount,
      executedCommands: input.execution.executedCommands,
      skippedCommands: input.execution.skippedCommands,
      drawCalls: input.execution.drawCalls,
      commandBuffers: input.finish.resource === null ? 0 : 1,
      submittedCommandBuffers: input.submit.submitted,
      skippedSubmissions: input.submit.skipped,
    },
    diagnostics,
  };
}

export function commandSubmissionMetricsReportToJsonValue(
  report: CommandSubmissionMetricsReport,
): CommandSubmissionMetricsReportJsonValue {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: report.ready,
    counts: {
      commands: report.counts.commands,
      executedCommands: report.counts.executedCommands,
      skippedCommands: report.counts.skippedCommands,
      drawCalls: report.counts.drawCalls,
      commandBuffers: report.counts.commandBuffers,
      submittedCommandBuffers: report.counts.submittedCommandBuffers,
      skippedSubmissions: report.counts.skippedSubmissions,
    },
    diagnostics: {
      total: diagnostics.total,
      bySeverity: {
        info: diagnostics.bySeverity.info,
        warning: diagnostics.bySeverity.warning,
        error: diagnostics.bySeverity.error,
      },
      byCode: { ...diagnostics.byCode },
    },
  };
}

export function commandSubmissionMetricsReportToJson(
  report: CommandSubmissionMetricsReport,
): string {
  return JSON.stringify(commandSubmissionMetricsReportToJsonValue(report));
}
