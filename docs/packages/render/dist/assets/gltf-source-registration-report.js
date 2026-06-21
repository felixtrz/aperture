export function gltfSourceAssetRegistrationReportToJsonValue(report) {
    return {
        valid: report.valid,
        written: report.written.map((entry) => ({
            ...entry,
            diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
            ...(entry.dependencyHandleKeys === undefined
                ? {}
                : { dependencyHandleKeys: [...entry.dependencyHandleKeys] }),
        })),
        skipped: report.skipped.map((entry) => ({
            ...entry,
            diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfSourceAssetRegistrationReportToJson(report) {
    return JSON.stringify(gltfSourceAssetRegistrationReportToJsonValue(report));
}
export function createGltfSourceAssetRegistrationReport(input) {
    return {
        valid: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        written: input.written,
        skipped: input.skipped,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=gltf-source-registration-report.js.map