export function createDrawPackageBatchingReport(packages) {
    const groups = new Map();
    for (const drawPackage of packages) {
        const key = batchKeyString(drawPackage.batchKey);
        const group = groups.get(key) ?? createMutableBatchGroup(key, drawPackage.batchKey);
        group.renderIds.push(drawPackage.renderId);
        group.meshResourceKeys.add(drawPackage.meshResourceKey);
        group.materialResourceKeys.add(drawPackage.materialResourceKey);
        groups.set(key, group);
    }
    const sortedGroups = [...groups.values()]
        .sort((a, b) => compareStrings(a.key, b.key))
        .map((group) => ({
        key: group.key,
        batchKey: group.batchKey,
        drawCount: group.renderIds.length,
        renderIds: [...group.renderIds].sort((a, b) => a - b),
        meshResourceKeys: [...group.meshResourceKeys].sort(compareStrings),
        materialResourceKeys: [...group.materialResourceKeys].sort(compareStrings),
    }));
    return {
        drawCount: packages.length,
        batchCount: sortedGroups.length,
        groups: sortedGroups,
        diagnostics: packages.length === 0
            ? [
                {
                    code: "drawBatching.emptyPackages",
                    message: "No draw packages were provided for batching.",
                    severity: "info",
                },
            ]
            : [],
    };
}
export function mergeDrawPackageBatchingReports(reports) {
    return {
        reportCount: reports.length,
        drawCount: reports.reduce((sum, report) => sum + report.drawCount, 0),
        batchCount: reports.reduce((sum, report) => sum + report.batchCount, 0),
        diagnostics: reports.flatMap((report) => [...report.diagnostics]),
    };
}
function createMutableBatchGroup(key, batchKey) {
    return {
        key,
        batchKey,
        renderIds: [],
        meshResourceKeys: new Set(),
        materialResourceKeys: new Set(),
    };
}
function batchKeyString(key) {
    return [
        key.pipelineKey,
        key.materialKey,
        key.meshLayoutKey,
        key.topology,
        key.instanced ? "instanced" : "single",
        key.skinned ? "skinned" : "rigid",
        key.morphed ? "morphed" : "static",
    ].join("|");
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=batching-report.js.map