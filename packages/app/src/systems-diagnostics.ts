import type { AssetDiagnostic } from "@aperture-engine/simulation";

export interface SystemDiagnostics {
  info(code: string, data?: Record<string, unknown>): void;
  warn(code: string, data?: Record<string, unknown>): void;
  error(code: string, data?: Record<string, unknown>): void;
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
  ): void {
    diagnostics.push({
      code,
      severity,
      message: code,
      ...(data === undefined ? {} : { data }),
    });
  }

  return {
    info(code, data) {
      push("info", code, data);
    },
    warn(code, data) {
      push("warning", code, data);
    },
    error(code, data) {
      push("error", code, data);
    },
    list() {
      return diagnostics.map((diagnostic) => ({ ...diagnostic }));
    },
  };
}

export function assetDiagnosticFromSystemDiagnostic(
  diagnostic: ApertureSystemDiagnostic,
): AssetDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
