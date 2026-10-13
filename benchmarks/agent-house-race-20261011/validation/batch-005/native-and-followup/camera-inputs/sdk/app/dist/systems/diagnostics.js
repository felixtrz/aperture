export function createDiagnostics() {
    const diagnostics = [];
    function push(severity, code, data, message) {
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