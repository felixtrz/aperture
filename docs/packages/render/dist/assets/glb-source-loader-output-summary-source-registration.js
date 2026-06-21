export function createGlbSourceLoaderSourceRegistrationSummaryJsonValue(report) {
    if (report === null) {
        return {
            status: "absent",
            valid: null,
            writtenCount: 0,
            skippedCount: 0,
            diagnosticsCount: 0,
            stages: [],
        };
    }
    return {
        status: report.valid ? "ready" : "invalid",
        valid: report.valid,
        writtenCount: report.stages.reduce((total, stage) => total + stage.writtenCount, 0),
        skippedCount: report.stages.reduce((total, stage) => total + stage.skippedCount, 0),
        diagnosticsCount: report.diagnostics.length +
            report.stages.reduce((total, stage) => total + stage.diagnosticCount, 0),
        stages: report.stages.map((stage) => ({ ...stage })),
    };
}
//# sourceMappingURL=glb-source-loader-output-summary-source-registration.js.map