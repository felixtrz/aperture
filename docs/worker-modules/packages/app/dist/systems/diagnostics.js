export function createDiagnostics() {
    const diagnostics = [];
    function push(severity, code, data) {
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
export function formatReportDiagnostics(diagnostics) {
    if (diagnostics.length === 0) {
        return "No detailed diagnostics were produced.";
    }
    return diagnostics
        .slice(0, 3)
        .map((diagnostic) => diagnostic.code === undefined
        ? (diagnostic.message ?? "Unknown diagnostic.")
        : `${diagnostic.code}: ${diagnostic.message ?? "Unknown diagnostic."}`)
        .join(" ");
}
//# sourceMappingURL=diagnostics.js.map