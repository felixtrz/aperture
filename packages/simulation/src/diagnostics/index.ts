export type DiagnosticSeverity = "info" | "warning" | "error";

export interface DiagnosticLike {
  readonly code: string;
  readonly severity?: DiagnosticSeverity;
}

export interface DiagnosticSummaryOptions {
  readonly defaultSeverity?: DiagnosticSeverity;
}

export interface DiagnosticSummary {
  readonly total: number;
  readonly bySeverity: Readonly<Record<DiagnosticSeverity, number>>;
  readonly byCode: Readonly<Record<string, number>>;
}

export function summarizeDiagnostics(
  diagnostics: readonly DiagnosticLike[],
  options: DiagnosticSummaryOptions = {},
): DiagnosticSummary {
  const bySeverity: Record<DiagnosticSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
  };
  const byCode: Record<string, number> = {};
  const defaultSeverity = options.defaultSeverity ?? "warning";

  for (const diagnostic of diagnostics) {
    const severity = diagnostic.severity ?? defaultSeverity;

    bySeverity[severity] += 1;
    byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
  }

  return {
    total: diagnostics.length,
    bySeverity,
    byCode,
  };
}
