export function summarizeDiagnostics(diagnostics, options = {}) {
    const bySeverity = {
        info: 0,
        warning: 0,
        error: 0,
    };
    const byCode = {};
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
//# sourceMappingURL=index.js.map