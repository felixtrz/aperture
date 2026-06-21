import { summarizeDiagnostics, } from "@aperture-engine/simulation";
import { createClearCompatibilityReport } from "../clear/clear-compatibility.js";
import { createCommandSubmissionMetricsReport } from "../../gpu/command-submission-metrics.js";
import { assembleFrameBoundary, } from "./frame-boundary.js";
import { summarizeFrameBoundaryDiagnostics, } from "./frame-boundary-diagnostics.js";
import { createFrameBoundarySmokeReport, } from "./frame-boundary-smoke.js";
import { createFrameBoundaryValidationReport, } from "./frame-boundary-validation.js";
import { createFrameSubmissionSmokeReport, } from "./frame-submission-smoke.js";
export function createFrameExecutionReport(assembly) {
    const boundarySmoke = createFrameBoundarySmokeReport(assembly);
    const clearCompatibility = createClearCompatibilityReport(assembly);
    const diagnosticSummary = summarizeFrameBoundaryDiagnostics(assembly);
    const boundaryValidation = createFrameBoundaryValidationReport({
        smoke: boundarySmoke,
        compatibility: clearCompatibility,
        summary: diagnosticSummary,
    });
    const submissionSmoke = createFrameSubmissionSmokeReport({
        attachments: assembly.attachments,
        begin: assembly.begin,
        execution: assembly.execution,
        end: assembly.end,
        finish: assembly.finish,
        submit: assembly.submit,
    });
    const commandSubmissionMetrics = assembly.execution === null ||
        assembly.finish === null ||
        assembly.submit === null
        ? null
        : createCommandSubmissionMetricsReport({
            execution: assembly.execution,
            finish: assembly.finish,
            submit: assembly.submit,
        });
    const commandSubmissionDiagnostics = commandSubmissionMetrics === null
        ? missingCommandSubmissionDiagnostics(assembly)
        : copyDiagnostics("commandSubmissionMetrics", commandSubmissionMetrics.diagnostics);
    const diagnostics = [
        ...copyDiagnostics("boundarySmoke", boundarySmoke.diagnostics),
        ...copyDiagnostics("clearCompatibility", clearCompatibility.diagnostics),
        ...copyDiagnostics("diagnosticSummary", diagnosticSummaryDiagnostics()),
        ...copyDiagnostics("boundaryValidation", boundaryValidation.diagnostics),
        ...copyDiagnostics("submissionSmoke", submissionSmoke.diagnostics),
        ...commandSubmissionDiagnostics,
    ];
    const sections = {
        boundarySmoke: status("boundarySmoke", true, boundarySmoke.ready, [
            ...boundarySmoke.diagnostics.map((diagnostic) => diagnostic.code),
        ]),
        clearCompatibility: status("clearCompatibility", true, clearCompatibility.ready, clearCompatibility.diagnostics.map((diagnostic) => diagnostic.code)),
        diagnosticSummary: status("diagnosticSummary", true, diagnosticSummary.ready, diagnosticSummary.ready ? [] : ["frameExecution.sourceDiagnostics"]),
        boundaryValidation: status("boundaryValidation", true, boundaryValidation.ready, boundaryValidation.diagnostics.map((diagnostic) => diagnostic.code)),
        submissionSmoke: status("submissionSmoke", true, submissionSmoke.ready, submissionSmoke.diagnostics.map((diagnostic) => diagnostic.code)),
        commandSubmissionMetrics: status("commandSubmissionMetrics", commandSubmissionMetrics !== null, commandSubmissionMetrics?.ready ?? false, commandSubmissionDiagnostics.map((diagnostic) => diagnostic.code)),
    };
    return {
        ready: Object.values(sections).every((section) => section.ready),
        sections,
        counts: {
            commands: assembly.execution?.commandCount ?? 0,
            executedCommands: assembly.execution?.executedCommands ?? 0,
            skippedCommands: assembly.execution?.skippedCommands ?? 0,
            drawCalls: assembly.execution?.drawCalls ?? 0,
            commandBuffers: assembly.finish?.resource === null
                ? 0
                : assembly.finish === null
                    ? 0
                    : 1,
            submittedCommandBuffers: assembly.submit?.submitted ?? 0,
            skippedSubmissions: assembly.submit?.skipped ?? 0,
            smokeDiagnostics: boundarySmoke.diagnostics.length,
            compatibilityDiagnostics: clearCompatibility.diagnostics.length,
            sourceDiagnostics: diagnosticSummary.diagnostics.total,
            validationDiagnostics: boundaryValidation.diagnostics.length,
            submissionDiagnostics: submissionSmoke.diagnostics.length,
            commandSubmissionDiagnostics: commandSubmissionDiagnostics.length,
            diagnostics: diagnostics.length,
        },
        reports: {
            boundarySmoke,
            clearCompatibility,
            diagnosticSummary,
            boundaryValidation,
            submissionSmoke,
            commandSubmissionMetrics,
        },
        diagnostics,
    };
}
export function runInjectedFrameExecution(options) {
    const assembly = assembleFrameBoundary(options);
    return {
        assembly,
        execution: createFrameExecutionReport(assembly),
    };
}
export function frameExecutionReportToJsonValue(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: report.ready,
        sections: {
            boundarySmoke: sectionToJsonValue(report.sections.boundarySmoke),
            clearCompatibility: sectionToJsonValue(report.sections.clearCompatibility),
            diagnosticSummary: sectionToJsonValue(report.sections.diagnosticSummary),
            boundaryValidation: sectionToJsonValue(report.sections.boundaryValidation),
            submissionSmoke: sectionToJsonValue(report.sections.submissionSmoke),
            commandSubmissionMetrics: sectionToJsonValue(report.sections.commandSubmissionMetrics),
        },
        counts: {
            commands: report.counts.commands,
            executedCommands: report.counts.executedCommands,
            skippedCommands: report.counts.skippedCommands,
            drawCalls: report.counts.drawCalls,
            commandBuffers: report.counts.commandBuffers,
            submittedCommandBuffers: report.counts.submittedCommandBuffers,
            skippedSubmissions: report.counts.skippedSubmissions,
            smokeDiagnostics: report.counts.smokeDiagnostics,
            compatibilityDiagnostics: report.counts.compatibilityDiagnostics,
            sourceDiagnostics: report.counts.sourceDiagnostics,
            validationDiagnostics: report.counts.validationDiagnostics,
            submissionDiagnostics: report.counts.submissionDiagnostics,
            commandSubmissionDiagnostics: report.counts.commandSubmissionDiagnostics,
            diagnostics: report.counts.diagnostics,
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
export function frameExecutionReportToJson(report) {
    return JSON.stringify(frameExecutionReportToJsonValue(report));
}
export function summarizeFrameExecutionDiagnosticsBySection(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: diagnostics.total === 0,
        sections: {
            boundarySmoke: summarizeSectionDiagnostics("boundarySmoke", report),
            clearCompatibility: summarizeSectionDiagnostics("clearCompatibility", report),
            diagnosticSummary: {
                section: "diagnosticSummary",
                diagnostics: cloneDiagnosticSummary(report.reports.diagnosticSummary.diagnostics),
            },
            boundaryValidation: summarizeSectionDiagnostics("boundaryValidation", report),
            submissionSmoke: summarizeSectionDiagnostics("submissionSmoke", report),
            commandSubmissionMetrics: summarizeSectionDiagnostics("commandSubmissionMetrics", report),
        },
        diagnostics,
    };
}
function status(section, present, ready, diagnosticCodes) {
    return {
        section,
        present,
        ready,
        diagnosticCodes,
    };
}
function sectionToJsonValue(section) {
    return {
        present: section.present,
        ready: section.ready,
        diagnosticCodes: [...section.diagnosticCodes],
    };
}
function summarizeSectionDiagnostics(section, report) {
    return {
        section,
        diagnostics: summarizeDiagnostics(report.diagnostics.filter((diagnostic) => diagnostic.section === section)),
    };
}
function cloneDiagnosticSummary(summary) {
    return {
        total: summary.total,
        bySeverity: {
            info: summary.bySeverity.info,
            warning: summary.bySeverity.warning,
            error: summary.bySeverity.error,
        },
        byCode: { ...summary.byCode },
    };
}
function copyDiagnostics(section, diagnostics) {
    return diagnostics.map((diagnostic) => ({
        section,
        code: diagnostic.code,
        message: diagnostic.message,
        severity: diagnostic.severity ?? "warning",
    }));
}
function diagnosticSummaryDiagnostics() {
    return [];
}
function missingCommandSubmissionDiagnostics(assembly) {
    const diagnostics = [];
    if (assembly.execution === null) {
        diagnostics.push({
            section: "commandSubmissionMetrics",
            code: "frameExecution.missingExecution",
            message: "Frame execution report cannot create command submission metrics without command execution output.",
            severity: "error",
        });
    }
    if (assembly.finish === null) {
        diagnostics.push({
            section: "commandSubmissionMetrics",
            code: "frameExecution.missingFinish",
            message: "Frame execution report cannot create command submission metrics without command buffer finish output.",
            severity: "error",
        });
    }
    if (assembly.submit === null) {
        diagnostics.push({
            section: "commandSubmissionMetrics",
            code: "frameExecution.missingSubmit",
            message: "Frame execution report cannot create command submission metrics without queue submission output.",
            severity: "error",
        });
    }
    return diagnostics;
}
//# sourceMappingURL=frame-execution-report.js.map