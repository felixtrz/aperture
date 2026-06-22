import {
  summarizeDiagnostics,
  type DiagnosticSummary,
} from "@aperture-engine/simulation";
import type { FrameBoundaryAssemblyReport } from "./frame-boundary.js";

export interface FrameBoundaryDiagnosticSummaryReport {
  readonly ready: boolean;
  readonly diagnostics: DiagnosticSummary;
}

export function summarizeFrameBoundaryDiagnostics(
  report: FrameBoundaryAssemblyReport,
): FrameBoundaryDiagnosticSummaryReport {
  const diagnostics = summarizeDiagnostics(
    [
      ...report.texture.diagnostics,
      ...(report.attachments?.diagnostics ?? []),
      ...(report.encoder?.diagnostics ?? []),
      ...(report.begin?.diagnostics ?? []),
      ...(report.rectangle?.diagnostics ?? []),
      ...(report.execution?.diagnostics ?? []),
      ...(report.renderBundle?.diagnostics ?? []),
      ...(report.end?.diagnostics ?? []),
      ...(report.finish?.diagnostics ?? []),
      ...(report.submit?.diagnostics ?? []),
    ],
    { defaultSeverity: "warning" },
  );

  return {
    ready: diagnostics.total === 0,
    diagnostics,
  };
}
