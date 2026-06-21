export function mergeFrameBoundaryDiagnosticSummaryReports(reports) {
    const bySeverity = {
        info: 0,
        warning: 0,
        error: 0,
    };
    const byCode = {};
    for (const report of reports) {
        bySeverity.info += report.diagnostics.bySeverity.info;
        bySeverity.warning += report.diagnostics.bySeverity.warning;
        bySeverity.error += report.diagnostics.bySeverity.error;
        for (const [code, count] of Object.entries(report.diagnostics.byCode)) {
            byCode[code] = (byCode[code] ?? 0) + count;
        }
    }
    const total = bySeverity.info + bySeverity.warning + bySeverity.error;
    return {
        ready: total === 0,
        reportCount: reports.length,
        diagnostics: {
            total,
            bySeverity,
            byCode,
        },
    };
}
//# sourceMappingURL=frame-boundary-diagnostics-merge.js.map