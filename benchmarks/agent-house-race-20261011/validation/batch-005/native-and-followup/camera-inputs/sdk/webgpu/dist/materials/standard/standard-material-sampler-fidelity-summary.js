const STANDARD_SAMPLER_FIELD_ORDER = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "clearcoatTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
];
export function createStandardMaterialSamplerFidelitySummary(reports) {
    const fieldCounts = new Map();
    const issueCounts = new Map();
    let readyMaterialCount = 0;
    let slotCount = 0;
    let warningCount = 0;
    let mipmapIssueCount = 0;
    let lodIssueCount = 0;
    let anisotropyIssueCount = 0;
    for (const report of reports) {
        if (report.ready) {
            readyMaterialCount += 1;
        }
        for (const slot of report.slots) {
            const bucket = fieldBucket(fieldCounts, slot.field);
            slotCount += 1;
            bucket.slotCount += 1;
        }
        for (const diagnostic of report.diagnostics) {
            const existingIssue = issueCounts.get(diagnostic.code);
            issueCounts.set(diagnostic.code, {
                code: diagnostic.code,
                count: (existingIssue?.count ?? 0) + 1,
            });
            if (diagnostic.severity === "warning") {
                warningCount += 1;
            }
            if (diagnostic.field !== undefined) {
                const bucket = fieldBucket(fieldCounts, diagnostic.field);
                bucket.warningCount += diagnostic.severity === "warning" ? 1 : 0;
            }
            switch (diagnostic.code) {
                case "standardMaterialSampler.mipmapFilterWithoutMips":
                    mipmapIssueCount += 1;
                    break;
                case "standardMaterialSampler.lodMaxExceedsMipRange":
                    lodIssueCount += 1;
                    break;
                case "standardMaterialSampler.anisotropyNotReported":
                    anisotropyIssueCount += 1;
                    break;
                case "standardMaterialSampler.missingMaterial":
                case "standardMaterialSampler.materialNotReady":
                case "standardMaterialSampler.unsupportedMaterialKind":
                case "standardMaterialSampler.textureNotReady":
                case "standardMaterialSampler.samplerNotReady":
                    break;
            }
        }
    }
    return {
        materialCount: reports.length,
        readyMaterialCount,
        blockedMaterialCount: reports.length - readyMaterialCount,
        slotCount,
        warningCount,
        byField: fieldEntries(fieldCounts),
        byIssue: issueEntries(issueCounts),
        mipmapIssueCount,
        lodIssueCount,
        anisotropyIssueCount,
    };
}
function fieldBucket(counts, field) {
    const existing = counts.get(field);
    if (existing !== undefined) {
        return existing;
    }
    const bucket = {
        field,
        slotCount: 0,
        warningCount: 0,
    };
    counts.set(field, bucket);
    return bucket;
}
function fieldEntries(counts) {
    return [...counts.values()].sort((a, b) => STANDARD_SAMPLER_FIELD_ORDER.indexOf(a.field) -
        STANDARD_SAMPLER_FIELD_ORDER.indexOf(b.field));
}
function issueEntries(counts) {
    return [...counts.values()].sort((a, b) => compareStrings(a.code, b.code));
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=standard-material-sampler-fidelity-summary.js.map