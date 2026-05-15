import type {
  DiagnosticSeverity,
  DiagnosticSummary,
} from "../diagnostics/index.js";
import { summarizeDiagnostics } from "../diagnostics/index.js";
import type { CommandSubmissionMetricsReport } from "./command-submission-metrics.js";
import type { FrameBoundaryValidationReport } from "./frame-boundary-validation.js";
import type { FrameExecutionReport } from "./frame-execution-report.js";
import type { FrameSubmissionSmokeReport } from "./frame-submission-smoke.js";
import {
  createMvpFrameReadinessReport,
  type MvpFrameReadinessReport,
} from "./mvp-frame-readiness.js";
import type { RenderPassAssemblySmokeReport } from "./render-pass-assembly-smoke.js";
import type { RendererAssemblySmokeReport } from "./renderer-assembly-smoke.js";

export type RendererFrameSummarySection =
  | "rendererAssembly"
  | "renderPassAssembly"
  | "frameSubmission"
  | "frameBoundary"
  | "mvpFrameReadiness"
  | "commandSubmissionMetrics";

export type RendererFrameSummaryMissingDiagnosticCode =
  | "rendererFrameSummary.missingRendererAssembly"
  | "rendererFrameSummary.missingRenderPassAssembly"
  | "rendererFrameSummary.missingFrameSubmission"
  | "rendererFrameSummary.missingFrameBoundary"
  | "rendererFrameSummary.missingMvpFrameReadiness"
  | "rendererFrameSummary.missingCommandSubmissionMetrics";

export interface RendererFrameSummaryDiagnostic {
  readonly section: RendererFrameSummarySection;
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly sourceSection?: string;
}

export interface RendererFrameSummarySectionStatus {
  readonly section: RendererFrameSummarySection;
  readonly present: boolean;
  readonly ready: boolean;
  readonly diagnosticCount: number;
}

export interface RendererFrameSummarySections {
  readonly rendererAssembly: RendererFrameSummarySectionStatus;
  readonly renderPassAssembly: RendererFrameSummarySectionStatus;
  readonly frameSubmission: RendererFrameSummarySectionStatus;
  readonly frameBoundary: RendererFrameSummarySectionStatus;
  readonly mvpFrameReadiness: RendererFrameSummarySectionStatus;
  readonly commandSubmissionMetrics: RendererFrameSummarySectionStatus;
}

export interface RendererFrameSummaryCounts {
  readonly plannedDraws: number;
  readonly drawCalls: number;
  readonly commands: number;
  readonly executedCommands: number;
  readonly skippedCommands: number;
  readonly commandBuffers: number;
  readonly submittedCommandBuffers: number;
  readonly skippedSubmissions: number;
  readonly diagnostics: number;
}

export interface RendererFrameSummaryInput {
  readonly renderer: RendererAssemblySmokeReport | null;
  readonly renderPass: RenderPassAssemblySmokeReport | null;
  readonly submission: FrameSubmissionSmokeReport | null;
  readonly boundary: FrameBoundaryValidationReport | null;
  readonly mvp: MvpFrameReadinessReport | null;
  readonly commandSubmission: CommandSubmissionMetricsReport | null;
}

export interface RendererFrameSummaryFromExecutionInput {
  readonly renderer: RendererAssemblySmokeReport | null;
  readonly renderPass: RenderPassAssemblySmokeReport | null;
  readonly execution: FrameExecutionReport | null;
}

export interface RendererFrameSummaryReport {
  readonly ready: boolean;
  readonly sections: RendererFrameSummarySections;
  readonly counts: RendererFrameSummaryCounts;
  readonly diagnostics: readonly RendererFrameSummaryDiagnostic[];
  readonly diagnosticSummary: DiagnosticSummary;
}

export interface RendererFrameSummarySectionJsonValue {
  readonly present: boolean;
  readonly ready: boolean;
  readonly diagnosticCount: number;
}

export interface RendererFrameSummarySectionsJsonValue {
  readonly rendererAssembly: RendererFrameSummarySectionJsonValue;
  readonly renderPassAssembly: RendererFrameSummarySectionJsonValue;
  readonly frameSubmission: RendererFrameSummarySectionJsonValue;
  readonly frameBoundary: RendererFrameSummarySectionJsonValue;
  readonly mvpFrameReadiness: RendererFrameSummarySectionJsonValue;
  readonly commandSubmissionMetrics: RendererFrameSummarySectionJsonValue;
}

export interface RendererFrameSummaryReportJsonValue {
  readonly ready: boolean;
  readonly sections: RendererFrameSummarySectionsJsonValue;
  readonly counts: RendererFrameSummaryCounts;
  readonly diagnostics: DiagnosticSummary;
}

export interface RendererFrameSummarySectionDiagnosticSummary {
  readonly section: RendererFrameSummarySection;
  readonly diagnostics: DiagnosticSummary;
}

export interface RendererFrameSummaryDiagnosticGroups {
  readonly rendererAssembly: RendererFrameSummarySectionDiagnosticSummary;
  readonly renderPassAssembly: RendererFrameSummarySectionDiagnosticSummary;
  readonly frameSubmission: RendererFrameSummarySectionDiagnosticSummary;
  readonly frameBoundary: RendererFrameSummarySectionDiagnosticSummary;
  readonly mvpFrameReadiness: RendererFrameSummarySectionDiagnosticSummary;
  readonly commandSubmissionMetrics: RendererFrameSummarySectionDiagnosticSummary;
}

export interface RendererFrameSummaryDiagnosticGroupReport {
  readonly ready: boolean;
  readonly sections: RendererFrameSummaryDiagnosticGroups;
  readonly diagnostics: DiagnosticSummary;
}

interface SectionReportLike {
  readonly ready: boolean;
  readonly diagnostics: readonly SourceDiagnosticLike[];
}

interface SourceDiagnosticLike {
  readonly code: string;
  readonly message?: string;
  readonly severity?: DiagnosticSeverity;
  readonly section?: string;
}

export function createRendererFrameSummaryReport(
  input: RendererFrameSummaryInput,
): RendererFrameSummaryReport {
  const renderer = evaluateSection({
    section: "rendererAssembly",
    report: input.renderer,
    missingCode: "rendererFrameSummary.missingRendererAssembly",
    missingMessage:
      "Renderer frame summary is missing renderer assembly report.",
  });
  const renderPass = evaluateSection({
    section: "renderPassAssembly",
    report: input.renderPass,
    missingCode: "rendererFrameSummary.missingRenderPassAssembly",
    missingMessage:
      "Renderer frame summary is missing render pass assembly report.",
  });
  const submission = evaluateSection({
    section: "frameSubmission",
    report: input.submission,
    missingCode: "rendererFrameSummary.missingFrameSubmission",
    missingMessage:
      "Renderer frame summary is missing frame submission report.",
  });
  const boundary = evaluateSection({
    section: "frameBoundary",
    report: input.boundary,
    missingCode: "rendererFrameSummary.missingFrameBoundary",
    missingMessage:
      "Renderer frame summary is missing frame boundary validation report.",
  });
  const mvp = evaluateSection({
    section: "mvpFrameReadiness",
    report: input.mvp,
    missingCode: "rendererFrameSummary.missingMvpFrameReadiness",
    missingMessage:
      "Renderer frame summary is missing MVP frame readiness report.",
  });
  const commandSubmission = evaluateSection({
    section: "commandSubmissionMetrics",
    report: input.commandSubmission,
    missingCode: "rendererFrameSummary.missingCommandSubmissionMetrics",
    missingMessage:
      "Renderer frame summary is missing command submission metrics report.",
  });
  const sections: RendererFrameSummarySections = {
    rendererAssembly: renderer.status,
    renderPassAssembly: renderPass.status,
    frameSubmission: submission.status,
    frameBoundary: boundary.status,
    mvpFrameReadiness: mvp.status,
    commandSubmissionMetrics: commandSubmission.status,
  };
  const diagnostics = [
    ...renderer.diagnostics,
    ...renderPass.diagnostics,
    ...submission.diagnostics,
    ...boundary.diagnostics,
    ...mvp.diagnostics,
    ...commandSubmission.diagnostics,
  ];

  return {
    ready: Object.values(sections).every((section) => section.ready),
    sections,
    counts: {
      plannedDraws: countPlannedDraws(input),
      drawCalls: countDrawCalls(input),
      commands: countCommands(input),
      executedCommands: countExecutedCommands(input),
      skippedCommands: countSkippedCommands(input),
      commandBuffers: countCommandBuffers(input),
      submittedCommandBuffers: countSubmittedCommandBuffers(input),
      skippedSubmissions: countSkippedSubmissions(input),
      diagnostics: diagnostics.length,
    },
    diagnostics,
    diagnosticSummary: summarizeDiagnostics(diagnostics),
  };
}

export function createRendererFrameSummaryFromExecutionReport(
  input: RendererFrameSummaryFromExecutionInput,
): RendererFrameSummaryReport {
  const mvp =
    input.renderer === null ||
    input.renderPass === null ||
    input.execution === null
      ? null
      : createMvpFrameReadinessReport({
          renderer: input.renderer,
          renderPass: input.renderPass,
          submission: input.execution.reports.submissionSmoke,
          boundary: input.execution.reports.boundaryValidation,
        });

  return createRendererFrameSummaryReport({
    renderer: input.renderer,
    renderPass: input.renderPass,
    submission: input.execution?.reports.submissionSmoke ?? null,
    boundary: input.execution?.reports.boundaryValidation ?? null,
    mvp,
    commandSubmission:
      input.execution?.reports.commandSubmissionMetrics ?? null,
  });
}

export function rendererFrameSummaryReportToJsonValue(
  report: RendererFrameSummaryReport,
): RendererFrameSummaryReportJsonValue {
  return {
    ready: report.ready,
    sections: {
      rendererAssembly: sectionToJsonValue(report.sections.rendererAssembly),
      renderPassAssembly: sectionToJsonValue(
        report.sections.renderPassAssembly,
      ),
      frameSubmission: sectionToJsonValue(report.sections.frameSubmission),
      frameBoundary: sectionToJsonValue(report.sections.frameBoundary),
      mvpFrameReadiness: sectionToJsonValue(report.sections.mvpFrameReadiness),
      commandSubmissionMetrics: sectionToJsonValue(
        report.sections.commandSubmissionMetrics,
      ),
    },
    counts: {
      plannedDraws: report.counts.plannedDraws,
      drawCalls: report.counts.drawCalls,
      commands: report.counts.commands,
      executedCommands: report.counts.executedCommands,
      skippedCommands: report.counts.skippedCommands,
      commandBuffers: report.counts.commandBuffers,
      submittedCommandBuffers: report.counts.submittedCommandBuffers,
      skippedSubmissions: report.counts.skippedSubmissions,
      diagnostics: report.counts.diagnostics,
    },
    diagnostics: {
      total: report.diagnosticSummary.total,
      bySeverity: {
        info: report.diagnosticSummary.bySeverity.info,
        warning: report.diagnosticSummary.bySeverity.warning,
        error: report.diagnosticSummary.bySeverity.error,
      },
      byCode: { ...report.diagnosticSummary.byCode },
    },
  };
}

export function rendererFrameSummaryReportToJson(
  report: RendererFrameSummaryReport,
): string {
  return JSON.stringify(rendererFrameSummaryReportToJsonValue(report));
}

export function summarizeRendererFrameSummaryDiagnosticsBySection(
  report: RendererFrameSummaryReport,
): RendererFrameSummaryDiagnosticGroupReport {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: diagnostics.total === 0,
    sections: {
      rendererAssembly: summarizeSectionDiagnostics("rendererAssembly", report),
      renderPassAssembly: summarizeSectionDiagnostics(
        "renderPassAssembly",
        report,
      ),
      frameSubmission: summarizeSectionDiagnostics("frameSubmission", report),
      frameBoundary: summarizeSectionDiagnostics("frameBoundary", report),
      mvpFrameReadiness: summarizeSectionDiagnostics(
        "mvpFrameReadiness",
        report,
      ),
      commandSubmissionMetrics: summarizeSectionDiagnostics(
        "commandSubmissionMetrics",
        report,
      ),
    },
    diagnostics,
  };
}

interface SectionEvaluationInput {
  readonly section: RendererFrameSummarySection;
  readonly report: SectionReportLike | null;
  readonly missingCode: RendererFrameSummaryMissingDiagnosticCode;
  readonly missingMessage: string;
}

interface SectionEvaluation {
  readonly status: RendererFrameSummarySectionStatus;
  readonly diagnostics: readonly RendererFrameSummaryDiagnostic[];
}

function evaluateSection(input: SectionEvaluationInput): SectionEvaluation {
  if (input.report === null) {
    return {
      status: {
        section: input.section,
        present: false,
        ready: false,
        diagnosticCount: 1,
      },
      diagnostics: [
        {
          section: input.section,
          code: input.missingCode,
          message: input.missingMessage,
          severity: "error",
        },
      ],
    };
  }

  const diagnostics = copySourceDiagnostics(
    input.section,
    input.report.diagnostics,
  );

  return {
    status: {
      section: input.section,
      present: true,
      ready: input.report.ready,
      diagnosticCount: diagnostics.length,
    },
    diagnostics,
  };
}

function sectionToJsonValue(
  section: RendererFrameSummarySectionStatus,
): RendererFrameSummarySectionJsonValue {
  return {
    present: section.present,
    ready: section.ready,
    diagnosticCount: section.diagnosticCount,
  };
}

function summarizeSectionDiagnostics(
  section: RendererFrameSummarySection,
  report: RendererFrameSummaryReport,
): RendererFrameSummarySectionDiagnosticSummary {
  return {
    section,
    diagnostics: summarizeDiagnostics(
      report.diagnostics.filter((diagnostic) => diagnostic.section === section),
    ),
  };
}

function copySourceDiagnostics(
  section: RendererFrameSummarySection,
  diagnostics: readonly SourceDiagnosticLike[],
): readonly RendererFrameSummaryDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    section,
    code: diagnostic.code,
    message: diagnostic.message ?? diagnostic.code,
    severity: diagnostic.severity ?? "warning",
    ...(diagnostic.section === undefined
      ? {}
      : { sourceSection: diagnostic.section }),
  }));
}

function countPlannedDraws(input: RendererFrameSummaryInput): number {
  return (
    input.renderPass?.summary.commands?.drawCount ??
    input.renderer?.summary.frame?.draws ??
    0
  );
}

function countDrawCalls(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.drawCalls ??
    input.submission?.summary.execution?.drawCalls ??
    input.renderPass?.summary.execution?.drawCalls ??
    0
  );
}

function countCommands(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.commands ??
    input.renderPass?.summary.commands?.commandCount ??
    0
  );
}

function countExecutedCommands(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.executedCommands ??
    input.submission?.summary.execution?.executedCommands ??
    input.renderPass?.summary.execution?.executedCommands ??
    0
  );
}

function countSkippedCommands(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.skippedCommands ??
    input.submission?.summary.execution?.skippedCommands ??
    input.renderPass?.summary.execution?.skippedCommands ??
    0
  );
}

function countCommandBuffers(input: RendererFrameSummaryInput): number {
  if (input.commandSubmission !== null) {
    return input.commandSubmission.counts.commandBuffers;
  }

  const finish = input.submission?.summary.finish ?? null;
  return finish?.commandBufferKey === null || finish === null ? 0 : 1;
}

function countSubmittedCommandBuffers(
  input: RendererFrameSummaryInput,
): number {
  return (
    input.commandSubmission?.counts.submittedCommandBuffers ??
    input.submission?.summary.submit?.submitted ??
    0
  );
}

function countSkippedSubmissions(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.skippedSubmissions ??
    input.submission?.summary.submit?.skipped ??
    0
  );
}
