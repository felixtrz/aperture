const MATERIAL_DEPENDENCY_KIND_ORDER = [
    "texture",
    "sampler",
];
const MATERIAL_DEPENDENCY_STATUS_ORDER = ["ready", "missing", "registered", "loading", "failed"];
export function createMaterialDependencyDiagnosticsSummary(reports) {
    const materialKindCounts = new Map();
    const dependencyKindCounts = new Map();
    const statusCounts = new Map();
    const diagnosticCodes = {};
    let readyMaterialCount = 0;
    let slotCount = 0;
    let readySlotCount = 0;
    let diagnosticCount = 0;
    for (const report of reports) {
        const materialBucket = materialKindBucket(materialKindCounts, report.materialKind ?? "unknown");
        materialBucket.materialCount += 1;
        if (report.ready) {
            readyMaterialCount += 1;
            materialBucket.readyMaterialCount += 1;
        }
        else {
            materialBucket.blockedMaterialCount += 1;
        }
        for (const slot of report.slots) {
            const dependencyBucket = dependencyKindBucket(dependencyKindCounts, slot.dependencyKind);
            const statusBucket = statusBucketFor(statusCounts, slot.status);
            slotCount += 1;
            dependencyBucket.slotCount += 1;
            statusBucket.slotCount += 1;
            if (slot.ready) {
                readySlotCount += 1;
                dependencyBucket.readySlotCount += 1;
            }
            else {
                dependencyBucket.blockedSlotCount += 1;
            }
        }
        for (const diagnostic of report.diagnostics) {
            diagnosticCount += 1;
            diagnosticCodes[diagnostic.code] =
                (diagnosticCodes[diagnostic.code] ?? 0) + 1;
        }
    }
    return {
        materialCount: reports.length,
        readyMaterialCount,
        blockedMaterialCount: reports.length - readyMaterialCount,
        slotCount,
        readySlotCount,
        blockedSlotCount: slotCount - readySlotCount,
        byMaterialKind: materialKindEntries(materialKindCounts),
        byDependencyKind: dependencyKindEntries(dependencyKindCounts),
        byStatus: statusEntries(statusCounts),
        diagnostics: {
            total: diagnosticCount,
            byCode: diagnosticCodes,
        },
    };
}
function materialKindBucket(counts, materialKind) {
    const existing = counts.get(materialKind);
    if (existing !== undefined) {
        return existing;
    }
    const bucket = {
        materialKind,
        materialCount: 0,
        readyMaterialCount: 0,
        blockedMaterialCount: 0,
    };
    counts.set(materialKind, bucket);
    return bucket;
}
function dependencyKindBucket(counts, dependencyKind) {
    const existing = counts.get(dependencyKind);
    if (existing !== undefined) {
        return existing;
    }
    const bucket = {
        dependencyKind,
        slotCount: 0,
        readySlotCount: 0,
        blockedSlotCount: 0,
    };
    counts.set(dependencyKind, bucket);
    return bucket;
}
function statusBucketFor(counts, status) {
    const existing = counts.get(status);
    if (existing !== undefined) {
        return existing;
    }
    const bucket = {
        status,
        slotCount: 0,
    };
    counts.set(status, bucket);
    return bucket;
}
function materialKindEntries(counts) {
    return [...counts.values()].sort((a, b) => compareStrings(a.materialKind, b.materialKind));
}
function dependencyKindEntries(counts) {
    return [...counts.values()].sort((a, b) => MATERIAL_DEPENDENCY_KIND_ORDER.indexOf(a.dependencyKind) -
        MATERIAL_DEPENDENCY_KIND_ORDER.indexOf(b.dependencyKind));
}
function statusEntries(counts) {
    return [...counts.values()].sort((a, b) => MATERIAL_DEPENDENCY_STATUS_ORDER.indexOf(a.status) -
        MATERIAL_DEPENDENCY_STATUS_ORDER.indexOf(b.status));
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=material-dependency-diagnostics-summary.js.map