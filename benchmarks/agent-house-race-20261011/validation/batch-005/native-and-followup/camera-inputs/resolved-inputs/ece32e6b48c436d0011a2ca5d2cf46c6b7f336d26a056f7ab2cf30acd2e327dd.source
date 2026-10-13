export function gltfEcsCommandReplayReportToJsonValue(report) {
    return {
        valid: report.valid,
        entityKeys: [...report.entitiesByKey.keys()],
        created: report.created.map((entry) => ({ ...entry })),
        appliedComponents: report.appliedComponents.map((entry) => ({ ...entry })),
        skipped: report.skipped.map((entry) => ({
            ...entry,
            diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfEcsCommandReplayReportToJson(report) {
    return JSON.stringify(gltfEcsCommandReplayReportToJsonValue(report));
}
export function createGltfEcsCommandReplayReport(input) {
    return {
        valid: input.diagnostics.length === 0,
        entitiesByKey: input.entitiesByKey,
        created: input.created,
        appliedComponents: input.appliedComponents,
        skipped: input.skipped,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=gltf-ecs-command-replay-report.js.map