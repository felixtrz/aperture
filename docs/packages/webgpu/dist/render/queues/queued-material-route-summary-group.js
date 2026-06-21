export function createQueuedMaterialPrepareRouteSummary(route) {
    return {
        valid: route.valid,
        status: route.status,
        family: route.family,
        hasFacadeMeshResourceKey: route.meshResourceKey !== null,
        hasFacadeMaterialResourceKey: route.materialResourceKey !== null,
        pipelineKey: route.pipelineKey,
        sourceVersion: route.sourceVersion,
        frame: route.frame,
        diagnostics: {
            total: route.diagnostics.length,
            byCode: diagnosticCodeCounts(route.diagnostics),
        },
    };
}
export function queuedMaterialPrepareRouteSummaryToJsonValue(summary) {
    return {
        valid: summary.valid,
        status: summary.status,
        family: summary.family,
        hasFacadeMeshResourceKey: summary.hasFacadeMeshResourceKey,
        hasFacadeMaterialResourceKey: summary.hasFacadeMaterialResourceKey,
        pipelineKey: summary.pipelineKey,
        sourceVersion: summary.sourceVersion,
        frame: summary.frame,
        diagnostics: {
            total: summary.diagnostics.total,
            byCode: { ...summary.diagnostics.byCode },
        },
    };
}
export function createQueuedMaterialRouteSummaryGroup(input) {
    const prepareRoutes = stageSummary(input.prepareRoutes ?? []);
    const frameResources = stageSummary(input.frameResources ?? []);
    return {
        prepareRoutes,
        frameResources,
        diagnostics: {
            total: prepareRoutes.diagnostics.total + frameResources.diagnostics.total,
            byCode: mergeDiagnosticCodeCounts([
                prepareRoutes.diagnostics.byCode,
                frameResources.diagnostics.byCode,
            ]),
        },
    };
}
export function queuedMaterialRouteSummaryGroupToJsonValue(group) {
    return {
        prepareRoutes: copyStageSummary(group.prepareRoutes),
        frameResources: copyStageSummary(group.frameResources),
        diagnostics: {
            total: group.diagnostics.total,
            byCode: { ...group.diagnostics.byCode },
        },
    };
}
function stageSummary(summaries) {
    let valid = 0;
    const byStatus = {};
    for (const summary of summaries) {
        if (summary.valid) {
            valid += 1;
        }
        byStatus[summary.status] = (byStatus[summary.status] ?? 0) + 1;
    }
    const diagnostics = mergeDiagnosticCodeCounts(summaries.map((summary) => summary.diagnostics.byCode));
    return {
        total: summaries.length,
        valid,
        invalid: summaries.length - valid,
        byStatus: sortRecord(byStatus),
        diagnostics: {
            total: summaries.reduce((total, summary) => total + summary.diagnostics.total, 0),
            byCode: diagnostics,
        },
    };
}
function copyStageSummary(summary) {
    return {
        total: summary.total,
        valid: summary.valid,
        invalid: summary.invalid,
        byStatus: { ...summary.byStatus },
        diagnostics: {
            total: summary.diagnostics.total,
            byCode: { ...summary.diagnostics.byCode },
        },
    };
}
function diagnosticCodeCounts(diagnostics) {
    const counts = {};
    for (const diagnostic of diagnostics) {
        const code = diagnosticCode(diagnostic);
        if (code === null) {
            continue;
        }
        counts[code] = (counts[code] ?? 0) + 1;
    }
    return sortRecord(counts);
}
function mergeDiagnosticCodeCounts(inputs) {
    const counts = {};
    for (const input of inputs) {
        for (const [code, count] of Object.entries(input)) {
            counts[code] = (counts[code] ?? 0) + count;
        }
    }
    return sortRecord(counts);
}
function sortRecord(record) {
    return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
function diagnosticCode(diagnostic) {
    if (typeof diagnostic !== "object" || diagnostic === null) {
        return null;
    }
    const code = diagnostic.code;
    return typeof code === "string" ? code : null;
}
//# sourceMappingURL=queued-material-route-summary-group.js.map