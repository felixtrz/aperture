export const RENDER_RESOURCE_LIFECYCLE_KINDS = [
    "mesh",
    "material",
    "view",
    "shader",
    "pipeline",
];
export function createRenderResourceLifecycleReport(input) {
    const byKind = Object.fromEntries(RENDER_RESOURCE_LIFECYCLE_KINDS.map((kind) => [
        kind,
        diffResourceKeys(input.previous[kind], input.next[kind]),
    ]));
    const totals = totalLifecycleCounts(byKind);
    return {
        byKind,
        totals,
        hasChanges: totals.created > 0 || totals.removed > 0,
    };
}
export function createRenderResourceInspectionReport(records) {
    const sorted = [...records].sort((a, b) => RENDER_RESOURCE_LIFECYCLE_KINDS.indexOf(a.kind) -
        RENDER_RESOURCE_LIFECYCLE_KINDS.indexOf(b.kind) ||
        a.resourceKey.localeCompare(b.resourceKey));
    const diagnostics = sorted.flatMap(resourceInspectionDiagnostic);
    return {
        records: sorted,
        counts: {
            total: sorted.length,
            live: sorted.filter((record) => record.status === "live").length,
            missing: sorted.filter((record) => record.status === "missing").length,
            stale: sorted.filter((record) => record.status === "stale").length,
            pendingDestroy: sorted.filter((record) => record.pendingDestroy || record.status === "pending-destroy").length,
        },
        diagnostics,
    };
}
function diffResourceKeys(previous, next) {
    return {
        retained: sortedKeys(next, (key) => previous.has(key)),
        created: sortedKeys(next, (key) => !previous.has(key)),
        removed: sortedKeys(previous, (key) => !next.has(key)),
    };
}
function sortedKeys(keys, include) {
    return [...keys].filter(include).sort();
}
function totalLifecycleCounts(byKind) {
    return RENDER_RESOURCE_LIFECYCLE_KINDS.reduce((totals, kind) => ({
        retained: totals.retained + byKind[kind].retained.length,
        created: totals.created + byKind[kind].created.length,
        removed: totals.removed + byKind[kind].removed.length,
    }), { retained: 0, created: 0, removed: 0 });
}
function resourceInspectionDiagnostic(record) {
    if (record.status === "missing") {
        return [
            {
                code: "renderResourceInspection.missingResource",
                kind: record.kind,
                status: record.status,
                resourceKey: record.resourceKey,
                ...(record.assetKey === undefined ? {} : { assetKey: record.assetKey }),
                message: `Renderer resource '${record.resourceKey}' is missing.`,
            },
        ];
    }
    if (record.status === "stale") {
        return [
            {
                code: "renderResourceInspection.staleResource",
                kind: record.kind,
                status: record.status,
                resourceKey: record.resourceKey,
                ...(record.assetKey === undefined ? {} : { assetKey: record.assetKey }),
                message: `Renderer resource '${record.resourceKey}' is stale.`,
            },
        ];
    }
    if (record.pendingDestroy || record.status === "pending-destroy") {
        return [
            {
                code: "renderResourceInspection.pendingDestroy",
                kind: record.kind,
                status: record.status,
                resourceKey: record.resourceKey,
                ...(record.assetKey === undefined ? {} : { assetKey: record.assetKey }),
                message: `Renderer resource '${record.resourceKey}' is pending destruction.`,
            },
        ];
    }
    return [];
}
//# sourceMappingURL=resource-lifecycle.js.map