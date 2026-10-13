/** Count current-frame draws without inventing standalone command submissions. */
export function normalizeShadowSubmittedDrawCounts(report, submission) {
    return {
        ...report,
        ...(report.casterCounts === undefined
            ? {}
            : {
                casterCounts: {
                    ...report.casterCounts,
                    submittedDrawCalls: submission === "cached" || submission === "graph-not-submitted"
                        ? 0
                        : submission === "graph-submitted"
                            ? report.drawCalls
                            : report.casterCounts.submittedDrawCalls,
                },
            }),
        ...(report.lightKindReports === undefined
            ? {}
            : {
                lightKindReports: report.lightKindReports.map((child) => normalizeShadowSubmittedDrawCounts(child, submission)),
            }),
    };
}
//# sourceMappingURL=shadow-submission-report.js.map