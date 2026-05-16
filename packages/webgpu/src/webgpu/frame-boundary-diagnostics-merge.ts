import type { DiagnosticSummary } from "@aperture-engine/simulation";
import type { FrameBoundaryDiagnosticSummaryReport } from "./frame-boundary-diagnostics.js";

export interface MergedFrameBoundaryDiagnosticSummaryReport {
  readonly ready: boolean;
  readonly reportCount: number;
  readonly diagnostics: DiagnosticSummary;
}

export function mergeFrameBoundaryDiagnosticSummaryReports(
  reports: readonly FrameBoundaryDiagnosticSummaryReport[],
): MergedFrameBoundaryDiagnosticSummaryReport {
  const bySeverity = {
    info: 0,
    warning: 0,
    error: 0,
  };
  const byCode: Record<string, number> = {};

  for (const report of reports) {
    bySeverity.info += report.diagnostics.bySeverity.info;
    bySeverity.warning += report.diagnostics.bySeverity.warning;
    bySeverity.error += report.diagnostics.bySeverity.error;

    for (const [code, count] of Object.entries(report.diagnostics.byCode)) {
      byCode[code] = (byCode[code] ?? 0) + count;
    }
  }

  const total = bySeverity.info + bySeverity.warning + bySeverity.error;

  return {
    ready: total === 0,
    reportCount: reports.length,
    diagnostics: {
      total,
      bySeverity,
      byCode,
    },
  };
}
