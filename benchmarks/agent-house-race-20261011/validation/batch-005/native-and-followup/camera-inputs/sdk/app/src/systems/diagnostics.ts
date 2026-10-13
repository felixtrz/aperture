export interface SystemDiagnostics {
  info(code: string, data?: Record<string, unknown>, message?: string): void;
  warn(code: string, data?: Record<string, unknown>, message?: string): void;
  error(code: string, data?: Record<string, unknown>, message?: string): void;
  list(): readonly ApertureSystemDiagnostic[];
}

export interface ApertureSystemDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix?: string;
}

export function createDiagnostics(): SystemDiagnostics {
  const diagnostics: ApertureSystemDiagnostic[] = [];

  function push(
    severity: ApertureSystemDiagnostic["severity"],
    code: string,
    data?: Record<string, unknown>,
    message?: string,
  ): void {
    diagnostics.push({
      code,
      severity,
      // A human message when the emitter provides one; the stable code
      // otherwise, so machine consumers can always key on `code`.
      message: message ?? code,
      ...(data === undefined ? {} : { data }),
    });
  }

  return {
    info(code, data, message) {
      push("info", code, data, message);
    },
    warn(code, data, message) {
      push("warning", code, data, message);
    },
    error(code, data, message) {
      push("error", code, data, message);
    },
    list() {
      return diagnostics.map((diagnostic) => ({ ...diagnostic }));
    },
  };
}

export function formatReportDiagnostics(
  diagnostics: readonly { readonly code?: string; readonly message?: string }[],
): string {
  if (diagnostics.length === 0) {
    return "No detailed diagnostics were produced.";
  }

  return diagnostics
    .slice(0, 3)
    .map((diagnostic) =>
      diagnostic.code === undefined
        ? (diagnostic.message ?? "Unknown diagnostic.")
        : `${diagnostic.code}: ${diagnostic.message ?? "Unknown diagnostic."}`,
    )
    .join(" ");
}
