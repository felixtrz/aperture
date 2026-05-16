import type { DiagnosticSummary } from "@aperture-engine/simulation";
import type { FrameBoundaryAssemblyReport } from "./frame-boundary.js";
import { summarizeFrameBoundaryDiagnostics } from "./frame-boundary-diagnostics.js";

export interface FrameBoundaryReportJsonValue {
  readonly valid: boolean;
  readonly sections: {
    readonly texture: boolean;
    readonly attachments: boolean | null;
    readonly encoder: boolean | null;
    readonly begin: boolean | null;
    readonly execution: boolean | null;
    readonly end: boolean | null;
    readonly finish: boolean | null;
    readonly submit: boolean | null;
  };
  readonly counts: {
    readonly colorTargets: number;
    readonly commands: number;
    readonly executedCommands: number;
    readonly skippedCommands: number;
    readonly drawCalls: number;
    readonly submittedCommandBuffers: number;
  };
  readonly diagnostics: DiagnosticSummary;
}

export function frameBoundaryReportToJsonValue(
  report: FrameBoundaryAssemblyReport,
): FrameBoundaryReportJsonValue {
  return {
    valid: report.valid,
    sections: {
      texture: report.texture.valid,
      attachments: report.attachments?.valid ?? null,
      encoder: report.encoder?.valid ?? null,
      begin: report.begin?.valid ?? null,
      execution: report.execution?.valid ?? null,
      end: report.end?.valid ?? null,
      finish: report.finish?.valid ?? null,
      submit: report.submit?.valid ?? null,
    },
    counts: {
      colorTargets: report.attachments?.plan?.colorAttachments.length ?? 0,
      commands: report.execution?.commandCount ?? 0,
      executedCommands: report.execution?.executedCommands ?? 0,
      skippedCommands: report.execution?.skippedCommands ?? 0,
      drawCalls: report.execution?.drawCalls ?? 0,
      submittedCommandBuffers: report.submit?.submitted ?? 0,
    },
    diagnostics: summarizeFrameBoundaryDiagnostics(report).diagnostics,
  };
}

export function frameBoundaryReportToJson(
  report: FrameBoundaryAssemblyReport,
): string {
  return JSON.stringify(frameBoundaryReportToJsonValue(report));
}
