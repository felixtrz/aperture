const STANDARD_TEXTURE_FIELD_ORDER = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
];
export function createStandardMaterialTextureFidelitySummary(reports) {
    const fieldCounts = new Map();
    const issueCounts = new Map();
    let readyMaterialCount = 0;
    let slotCount = 0;
    let readySlotCount = 0;
    let samplerIssueCount = 0;
    let colorSpaceIssueCount = 0;
    let semanticIssueCount = 0;
    let texCoordIssueCount = 0;
    let transformIssueCount = 0;
    for (const report of reports) {
        const fields = new Map();
        if (report.ready) {
            readyMaterialCount += 1;
        }
        for (const slot of report.slots) {
            const field = fieldReadiness(fields, slot.field);
            field.seen = true;
            field.ready = field.ready && slot.ready;
        }
        for (const diagnostic of report.diagnostics) {
            const existingIssue = issueCounts.get(diagnostic.code);
            issueCounts.set(diagnostic.code, {
                code: diagnostic.code,
                count: (existingIssue?.count ?? 0) + 1,
            });
            switch (diagnostic.code) {
                case "standardMaterialTexture.missingSamplerHandle":
                case "standardMaterialTexture.samplerNotReady":
                    samplerIssueCount += 1;
                    break;
                case "standardMaterialTexture.invalidColorSpace":
                case "standardMaterialTexture.invalidColorSpaceFormat":
                    colorSpaceIssueCount += 1;
                    break;
                case "standardMaterialTexture.invalidSemantic":
                    semanticIssueCount += 1;
                    break;
                case "standardMaterialTexture.unsupportedTexCoord":
                    texCoordIssueCount += 1;
                    break;
                case "standardMaterialTexture.unsupportedTextureTransform":
                    transformIssueCount += 1;
                    break;
                case "standardMaterialTexture.missingMaterial":
                case "standardMaterialTexture.materialNotReady":
                case "standardMaterialTexture.unsupportedMaterialKind":
                case "standardMaterialTexture.missingTextureHandle":
                case "standardMaterialTexture.textureNotReady":
                    break;
            }
            if (diagnostic.field !== undefined) {
                const field = fieldReadiness(fields, diagnostic.field);
                field.seen = true;
                field.ready = false;
            }
        }
        for (const field of fields.values()) {
            const bucket = fieldBucket(fieldCounts, field.field);
            slotCount += 1;
            bucket.slotCount += 1;
            if (field.ready) {
                readySlotCount += 1;
                bucket.readySlotCount += 1;
            }
            else {
                bucket.blockedSlotCount += 1;
            }
        }
    }
    return {
        materialCount: reports.length,
        readyMaterialCount,
        blockedMaterialCount: reports.length - readyMaterialCount,
        slotCount,
        readySlotCount,
        blockedSlotCount: slotCount - readySlotCount,
        byField: fieldEntries(fieldCounts),
        byIssue: issueEntries(issueCounts),
        samplerIssueCount,
        colorSpaceIssueCount,
        semanticIssueCount,
        texCoordIssueCount,
        transformIssueCount,
    };
}
function fieldReadiness(fields, field) {
    const existing = fields.get(field);
    if (existing !== undefined) {
        return existing;
    }
    const readiness = {
        field,
        seen: false,
        ready: true,
    };
    fields.set(field, readiness);
    return readiness;
}
function fieldBucket(counts, field) {
    const existing = counts.get(field);
    if (existing !== undefined) {
        return existing;
    }
    const bucket = {
        field,
        slotCount: 0,
        readySlotCount: 0,
        blockedSlotCount: 0,
    };
    counts.set(field, bucket);
    return bucket;
}
function fieldEntries(counts) {
    return [...counts.values()].sort((a, b) => STANDARD_TEXTURE_FIELD_ORDER.indexOf(a.field) -
        STANDARD_TEXTURE_FIELD_ORDER.indexOf(b.field));
}
function issueEntries(counts) {
    return [...counts.values()].sort((a, b) => compareStrings(a.code, b.code));
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=standard-material-texture-fidelity-summary.js.map