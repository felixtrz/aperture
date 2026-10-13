export function clearParityReportToJsonValue(report) {
    return {
        ready: report.ready,
        clearReady: report.clearReady,
        boundaryReady: report.boundaryReady,
        diagnostics: report.diagnostics,
    };
}
export function clearParityReportToJson(report) {
    return JSON.stringify(clearParityReportToJsonValue(report));
}
//# sourceMappingURL=clear-parity-json.js.map