import type { ClearCompatibilityReport } from "../clear/clear-compatibility.js";
import type { FrameBoundaryDiagnosticSummaryReport } from "./frame-boundary-diagnostics.js";
import type { FrameBoundarySmokeReport } from "./frame-boundary-smoke.js";

export type FrameBoundaryValidationDiagnosticCode =
  | "frameBoundaryValidation.smokeNotReady"
  | "frameBoundaryValidation.compatibilityNotReady"
  | "frameBoundaryValidation.diagnosticWarnings"
  | "frameBoundaryValidation.diagnosticErrors";

export interface FrameBoundaryValidationDiagnostic {
  readonly code: FrameBoundaryValidationDiagnosticCode;
  readonly message: string;
}

export interface FrameBoundaryValidationReport {
  readonly ready: boolean;
  readonly counts: {
    readonly smokeDiagnostics: number;
    readonly compatibilityDiagnostics: number;
    readonly sourceDiagnostics: number;
    readonly warnings: number;
    readonly errors: number;
  };
  readonly diagnostics: readonly FrameBoundaryValidationDiagnostic[];
}

export function createFrameBoundaryValidationReport(input: {
  readonly smoke: FrameBoundarySmokeReport;
  readonly compatibility: ClearCompatibilityReport;
  readonly summary: FrameBoundaryDiagnosticSummaryReport;
}): FrameBoundaryValidationReport {
  const diagnostics: FrameBoundaryValidationDiagnostic[] = [];
  const warnings = input.summary.diagnostics.bySeverity.warning;
  const errors = input.summary.diagnostics.bySeverity.error;

  if (!input.smoke.ready) {
    diagnostics.push({
      code: "frameBoundaryValidation.smokeNotReady",
      message: "Frame boundary smoke report is not ready.",
    });
  }

  if (!input.compatibility.ready) {
    diagnostics.push({
      code: "frameBoundaryValidation.compatibilityNotReady",
      message: "Clear compatibility report is not ready.",
    });
  }

  if (warnings > 0) {
    diagnostics.push({
      code: "frameBoundaryValidation.diagnosticWarnings",
      message: `Frame boundary source diagnostics include ${warnings} warning(s).`,
    });
  }

  if (errors > 0) {
    diagnostics.push({
      code: "frameBoundaryValidation.diagnosticErrors",
      message: `Frame boundary source diagnostics include ${errors} error(s).`,
    });
  }

  return {
    ready: diagnostics.length === 0,
    counts: {
      smokeDiagnostics: input.smoke.diagnostics.length,
      compatibilityDiagnostics: input.compatibility.diagnostics.length,
      sourceDiagnostics: input.summary.diagnostics.total,
      warnings,
      errors,
    },
    diagnostics,
  };
}
