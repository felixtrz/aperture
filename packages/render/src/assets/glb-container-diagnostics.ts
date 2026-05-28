import type {
  GlbContainerDiagnostic,
  GlbContainerDiagnosticCode,
  GlbContainerDiagnosticInput,
  GlbContainerDiagnosticSeverity,
} from "./glb-container-types.js";

export function createGlbContainerDiagnostic(
  input: GlbContainerDiagnosticInput,
): GlbContainerDiagnostic {
  const diagnostic: {
    code: GlbContainerDiagnosticCode;
    message: string;
    severity: GlbContainerDiagnosticSeverity;
    byteOffset?: number;
    byteLength?: number;
    chunkType?: number;
  } = {
    code: input.code,
    message: input.message,
    severity: input.severity,
  };

  if (input.byteOffset !== undefined) {
    diagnostic.byteOffset = input.byteOffset;
  }
  if (input.byteLength !== undefined) {
    diagnostic.byteLength = input.byteLength;
  }
  if (input.chunkType !== undefined) {
    diagnostic.chunkType = input.chunkType;
  }

  return diagnostic;
}

export function createErrorDiagnostic(
  input: Omit<GlbContainerDiagnosticInput, "severity">,
): GlbContainerDiagnostic {
  return createGlbContainerDiagnostic({ ...input, severity: "error" });
}

export function createWarningDiagnostic(
  input: Omit<GlbContainerDiagnosticInput, "severity">,
): GlbContainerDiagnostic {
  return createGlbContainerDiagnostic({ ...input, severity: "warning" });
}

export function hasErrorDiagnostics(
  diagnostics: readonly GlbContainerDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
