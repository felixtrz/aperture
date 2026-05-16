import {
  summarizeDiagnostics,
  type DiagnosticSeverity,
  type DiagnosticSummary,
} from "@aperture-engine/simulation";
import { createClearCompatibilityReport } from "./clear-compatibility.js";
import type { ClearCompatibilityReport } from "./clear-compatibility.js";
import { createCommandSubmissionMetricsReport } from "./command-submission-metrics.js";
import type { CommandSubmissionMetricsReport } from "./command-submission-metrics.js";
import {
  assembleFrameBoundary,
  type AssembleFrameBoundaryOptions,
  type FrameBoundaryAssemblyReport,
} from "./frame-boundary.js";
import {
  summarizeFrameBoundaryDiagnostics,
  type FrameBoundaryDiagnosticSummaryReport,
} from "./frame-boundary-diagnostics.js";
import {
  createFrameBoundarySmokeReport,
  type FrameBoundarySmokeReport,
} from "./frame-boundary-smoke.js";
import {
  createFrameBoundaryValidationReport,
  type FrameBoundaryValidationReport,
} from "./frame-boundary-validation.js";
import {
  createFrameSubmissionSmokeReport,
  type FrameSubmissionSmokeReport,
} from "./frame-submission-smoke.js";

export type FrameExecutionSection =
  | "boundarySmoke"
  | "clearCompatibility"
  | "diagnosticSummary"
  | "boundaryValidation"
  | "submissionSmoke"
  | "commandSubmissionMetrics";

export type FrameExecutionDiagnosticCode =
  | "frameExecution.missingExecution"
  | "frameExecution.missingFinish"
  | "frameExecution.missingSubmit";

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

interface DiagnosticLike {
  readonly code: string;
  readonly message: string;
  readonly severity?: DiagnosticSeverity;
}

export function createFrameExecutionReport(
  assembly: FrameBoundaryAssemblyReport,
): FrameExecutionReport {
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
  const commandSubmissionMetrics =
    assembly.execution === null ||
    assembly.finish === null ||
    assembly.submit === null
      ? null
      : createCommandSubmissionMetricsReport({
          execution: assembly.execution,
          finish: assembly.finish,
          submit: assembly.submit,
        });
  const commandSubmissionDiagnostics =
    commandSubmissionMetrics === null
      ? missingCommandSubmissionDiagnostics(assembly)
      : copyDiagnostics(
          "commandSubmissionMetrics",
          commandSubmissionMetrics.diagnostics,
        );
  const diagnostics = [
    ...copyDiagnostics("boundarySmoke", boundarySmoke.diagnostics),
    ...copyDiagnostics("clearCompatibility", clearCompatibility.diagnostics),
    ...copyDiagnostics("diagnosticSummary", diagnosticSummaryDiagnostics()),
    ...copyDiagnostics("boundaryValidation", boundaryValidation.diagnostics),
    ...copyDiagnostics("submissionSmoke", submissionSmoke.diagnostics),
    ...commandSubmissionDiagnostics,
  ];
  const sections: FrameExecutionSections = {
    boundarySmoke: status("boundarySmoke", true, boundarySmoke.ready, [
      ...boundarySmoke.diagnostics.map((diagnostic) => diagnostic.code),
    ]),
    clearCompatibility: status(
      "clearCompatibility",
      true,
      clearCompatibility.ready,
      clearCompatibility.diagnostics.map((diagnostic) => diagnostic.code),
    ),
    diagnosticSummary: status(
      "diagnosticSummary",
      true,
      diagnosticSummary.ready,
      diagnosticSummary.ready ? [] : ["frameExecution.sourceDiagnostics"],
    ),
    boundaryValidation: status(
      "boundaryValidation",
      true,
      boundaryValidation.ready,
      boundaryValidation.diagnostics.map((diagnostic) => diagnostic.code),
    ),
    submissionSmoke: status(
      "submissionSmoke",
      true,
      submissionSmoke.ready,
      submissionSmoke.diagnostics.map((diagnostic) => diagnostic.code),
    ),
    commandSubmissionMetrics: status(
      "commandSubmissionMetrics",
      commandSubmissionMetrics !== null,
      commandSubmissionMetrics?.ready ?? false,
      commandSubmissionDiagnostics.map((diagnostic) => diagnostic.code),
    ),
  };

  return {
    ready: Object.values(sections).every((section) => section.ready),
    sections,
    counts: {
      commands: assembly.execution?.commandCount ?? 0,
      executedCommands: assembly.execution?.executedCommands ?? 0,
      skippedCommands: assembly.execution?.skippedCommands ?? 0,
      drawCalls: assembly.execution?.drawCalls ?? 0,
      commandBuffers:
        assembly.finish?.resource === null
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

export function runInjectedFrameExecution(
  options: AssembleFrameBoundaryOptions,
): InjectedFrameExecutionRunnerReport {
  const assembly = assembleFrameBoundary(options);

  return {
    assembly,
    execution: createFrameExecutionReport(assembly),
  };
}

export function frameExecutionReportToJsonValue(
  report: FrameExecutionReport,
): FrameExecutionReportJsonValue {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: report.ready,
    sections: {
      boundarySmoke: sectionToJsonValue(report.sections.boundarySmoke),
      clearCompatibility: sectionToJsonValue(
        report.sections.clearCompatibility,
      ),
      diagnosticSummary: sectionToJsonValue(report.sections.diagnosticSummary),
      boundaryValidation: sectionToJsonValue(
        report.sections.boundaryValidation,
      ),
      submissionSmoke: sectionToJsonValue(report.sections.submissionSmoke),
      commandSubmissionMetrics: sectionToJsonValue(
        report.sections.commandSubmissionMetrics,
      ),
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

export function frameExecutionReportToJson(
  report: FrameExecutionReport,
): string {
  return JSON.stringify(frameExecutionReportToJsonValue(report));
}

export function summarizeFrameExecutionDiagnosticsBySection(
  report: FrameExecutionReport,
): FrameExecutionDiagnosticGroupReport {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: diagnostics.total === 0,
    sections: {
      boundarySmoke: summarizeSectionDiagnostics("boundarySmoke", report),
      clearCompatibility: summarizeSectionDiagnostics(
        "clearCompatibility",
        report,
      ),
      diagnosticSummary: {
        section: "diagnosticSummary",
        diagnostics: cloneDiagnosticSummary(
          report.reports.diagnosticSummary.diagnostics,
        ),
      },
      boundaryValidation: summarizeSectionDiagnostics(
        "boundaryValidation",
        report,
      ),
      submissionSmoke: summarizeSectionDiagnostics("submissionSmoke", report),
      commandSubmissionMetrics: summarizeSectionDiagnostics(
        "commandSubmissionMetrics",
        report,
      ),
    },
    diagnostics,
  };
}

function status(
  section: FrameExecutionSection,
  present: boolean,
  ready: boolean,
  diagnosticCodes: readonly string[],
): FrameExecutionSectionStatus {
  return {
    section,
    present,
    ready,
    diagnosticCodes,
  };
}

function sectionToJsonValue(
  section: FrameExecutionSectionStatus,
): FrameExecutionSectionJsonValue {
  return {
    present: section.present,
    ready: section.ready,
    diagnosticCodes: [...section.diagnosticCodes],
  };
}

function summarizeSectionDiagnostics(
  section: FrameExecutionSection,
  report: FrameExecutionReport,
): FrameExecutionSectionDiagnosticSummary {
  return {
    section,
    diagnostics: summarizeDiagnostics(
      report.diagnostics.filter((diagnostic) => diagnostic.section === section),
    ),
  };
}

function cloneDiagnosticSummary(summary: DiagnosticSummary): DiagnosticSummary {
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

function copyDiagnostics(
  section: FrameExecutionSection,
  diagnostics: readonly DiagnosticLike[],
): readonly FrameExecutionDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    section,
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity ?? "warning",
  }));
}

function diagnosticSummaryDiagnostics(): readonly DiagnosticLike[] {
  return [];
}

function missingCommandSubmissionDiagnostics(
  assembly: FrameBoundaryAssemblyReport,
): readonly FrameExecutionDiagnostic[] {
  const diagnostics: FrameExecutionDiagnostic[] = [];

  if (assembly.execution === null) {
    diagnostics.push({
      section: "commandSubmissionMetrics",
      code: "frameExecution.missingExecution",
      message:
        "Frame execution report cannot create command submission metrics without command execution output.",
      severity: "error",
    });
  }

  if (assembly.finish === null) {
    diagnostics.push({
      section: "commandSubmissionMetrics",
      code: "frameExecution.missingFinish",
      message:
        "Frame execution report cannot create command submission metrics without command buffer finish output.",
      severity: "error",
    });
  }

  if (assembly.submit === null) {
    diagnostics.push({
      section: "commandSubmissionMetrics",
      code: "frameExecution.missingSubmit",
      message:
        "Frame execution report cannot create command submission metrics without queue submission output.",
      severity: "error",
    });
  }

  return diagnostics;
}
