import { summarizeDiagnostics, } from "@aperture-engine/simulation";
export function createCommandSubmissionMetricsReport(input) {
    const diagnostics = [];
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
/**
 * Aggregate metrics for a single command buffer assembled from MANY passes
 * (the FrameGraph single-encoder path): commands/executedCommands/drawCalls sum
 * across all render + compute node executions, while commandBuffers/submitted
 * reflect the one finish + one submit of the shared encoder.
 */
export function createMultiPassCommandSubmissionMetricsReport(input) {
    const diagnostics = [];
    if (input.executions.some((execution) => !execution.valid)) {
        diagnostics.push({
            code: "commandSubmissionMetrics.executionFailed",
            message: "One or more render/compute pass executions failed.",
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
    let commands = 0;
    let executedCommands = 0;
    let skippedCommands = 0;
    let drawCalls = 0;
    for (const execution of input.executions) {
        commands += execution.commandCount;
        executedCommands += execution.executedCommands;
        skippedCommands += execution.skippedCommands;
        drawCalls += execution.drawCalls ?? 0;
    }
    return {
        ready: diagnostics.length === 0,
        counts: {
            commands,
            executedCommands,
            skippedCommands,
            drawCalls,
            commandBuffers: input.finish.resource === null ? 0 : 1,
            submittedCommandBuffers: input.submit.submitted,
            skippedSubmissions: input.submit.skipped,
        },
        diagnostics,
    };
}
export function commandSubmissionMetricsReportToJsonValue(report) {
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
export function commandSubmissionMetricsReportToJson(report) {
    return JSON.stringify(commandSubmissionMetricsReportToJsonValue(report));
}
//# sourceMappingURL=command-submission-metrics.js.map