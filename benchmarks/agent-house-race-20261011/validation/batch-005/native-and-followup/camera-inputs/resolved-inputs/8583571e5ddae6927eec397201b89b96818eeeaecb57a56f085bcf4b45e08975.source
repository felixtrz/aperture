export function webgpuDiagnosticsArray(diagnostics, key) {
    const value = webgpuDiagnosticValue(diagnostics, key);
    const nested = isRecord(value) ? value["diagnostics"] : undefined;
    return Array.isArray(nested) ? nested : [];
}
export function webgpuDiagnosticValue(diagnostics, key) {
    return isRecord(diagnostics) ? diagnostics[key] : null;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=webgpu-diagnostics.js.map