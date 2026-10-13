import type { ClearParityReport } from "./clear-parity.js";

export interface ClearParityReportJsonValue {
  readonly ready: boolean;
  readonly clearReady: boolean;
  readonly boundaryReady: boolean;
  readonly diagnostics: ClearParityReport["diagnostics"];
}

export function clearParityReportToJsonValue(
  report: ClearParityReport,
): ClearParityReportJsonValue {
  return {
    ready: report.ready,
    clearReady: report.clearReady,
    boundaryReady: report.boundaryReady,
    diagnostics: report.diagnostics,
  };
}

export function clearParityReportToJson(report: ClearParityReport): string {
  return JSON.stringify(clearParityReportToJsonValue(report));
}
