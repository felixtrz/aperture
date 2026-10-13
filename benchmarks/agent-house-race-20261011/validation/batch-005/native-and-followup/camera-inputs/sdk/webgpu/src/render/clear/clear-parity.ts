import type { WebGpuClearResult } from "./clear.js";
import type { ClearCompatibilityReport } from "./clear-compatibility.js";

export type ClearParityDiagnosticCode =
  | "clearParity.clearFailedBoundaryReady"
  | "clearParity.clearSucceededBoundaryFailed"
  | "clearParity.bothFailed";

export interface ClearParityDiagnostic {
  readonly code: ClearParityDiagnosticCode;
  readonly message: string;
}

export interface ClearParityReport {
  readonly ready: boolean;
  readonly clearReady: boolean;
  readonly boundaryReady: boolean;
  readonly diagnostics: readonly ClearParityDiagnostic[];
}

export function createClearParityReport(
  clear: WebGpuClearResult,
  compatibility: ClearCompatibilityReport,
): ClearParityReport {
  const clearReady = clear.ok;
  const boundaryReady = compatibility.ready;

  if (clearReady && boundaryReady) {
    return { ready: true, clearReady, boundaryReady, diagnostics: [] };
  }

  if (!clearReady && !boundaryReady) {
    return {
      ready: false,
      clearReady,
      boundaryReady,
      diagnostics: [
        {
          code: "clearParity.bothFailed",
          message:
            "Both clearWebGpuCanvas and frame-boundary compatibility report failed.",
        },
      ],
    };
  }

  if (!clearReady) {
    return {
      ready: false,
      clearReady,
      boundaryReady,
      diagnostics: [
        {
          code: "clearParity.clearFailedBoundaryReady",
          message:
            "clearWebGpuCanvas failed while frame-boundary compatibility reported ready.",
        },
      ],
    };
  }

  return {
    ready: false,
    clearReady,
    boundaryReady,
    diagnostics: [
      {
        code: "clearParity.clearSucceededBoundaryFailed",
        message:
          "clearWebGpuCanvas succeeded while frame-boundary compatibility reported missing requirements.",
      },
    ],
  };
}
