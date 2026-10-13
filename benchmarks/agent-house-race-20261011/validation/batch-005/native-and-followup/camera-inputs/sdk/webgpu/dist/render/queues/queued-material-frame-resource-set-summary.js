export function createQueuedMaterialFrameResourceSetSummary(items, options = {}) {
    const familyCounts = new Map();
    const pipelineCounts = new Map();
    const familyPipelineCounts = new Map();
    for (const item of items) {
        increment(familyCounts, item.materialFamily);
        increment(pipelineCounts, item.pipelineKey);
        let pipelineBuckets = familyPipelineCounts.get(item.materialFamily);
        if (pipelineBuckets === undefined) {
            pipelineBuckets = new Map();
            familyPipelineCounts.set(item.materialFamily, pipelineBuckets);
        }
        increment(pipelineBuckets, item.pipelineKey);
    }
    return {
        itemCount: items.length,
        byFamily: options.byFamily === undefined
            ? stringEntries(familyCounts).map(([family, itemCount]) => ({
                family,
                itemCount,
            }))
            : sortedFamilySummary(options.byFamily),
        byPipeline: stringEntries(pipelineCounts).map(([pipelineKey, itemCount]) => ({
            pipelineKey,
            itemCount,
        })),
        byFamilyAndPipeline: stringEntries(familyPipelineCounts).flatMap(([family, pipelineBuckets]) => stringEntries(pipelineBuckets).map(([pipelineKey, itemCount]) => ({
            family,
            pipelineKey,
            itemCount,
        }))),
    };
}
function increment(counts, key) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
}
function stringEntries(counts) {
    return [...counts.entries()].sort(([a], [b]) => compareStrings(a, b));
}
function sortedFamilySummary(summary) {
    return [...summary]
        .sort((a, b) => compareStrings(a.family, b.family))
        .map(({ family, itemCount }) => ({ family, itemCount }));
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=queued-material-frame-resource-set-summary.js.map