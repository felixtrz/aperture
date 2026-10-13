export function webgpuDiagnosticsArray(
  diagnostics: unknown,
  key: string,
): readonly unknown[] {
  const value = webgpuDiagnosticValue(diagnostics, key);
  const nested = isRecord(value) ? value["diagnostics"] : undefined;

  return Array.isArray(nested) ? nested : [];
}

export function webgpuDiagnosticValue(
  diagnostics: unknown,
  key: string,
): unknown {
  return isRecord(diagnostics) ? diagnostics[key] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
