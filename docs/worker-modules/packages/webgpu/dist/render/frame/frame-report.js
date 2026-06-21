import { summarizeDiagnostics, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export function createFrameReport(input) {
    return {
        frame: input.frame,
        ready: input.readiness.ready,
        draws: input.batching.drawCount,
        batches: input.batching.batchCount,
        resources: input.resources.counts,
        diagnostics: summarizeDiagnostics([
            ...input.readiness.diagnostics,
            ...input.resources.diagnostics,
            ...input.batching.diagnostics,
        ]),
    };
}
export function frameReportToJsonValue(report) {
    return {
        frame: report.frame,
        ready: report.ready,
        draws: report.draws,
        batches: report.batches,
        resources: report.resources,
        diagnostics: report.diagnostics,
    };
}
export function frameReportToJson(report) {
    return JSON.stringify(frameReportToJsonValue(report));
}
//# sourceMappingURL=frame-report.js.map