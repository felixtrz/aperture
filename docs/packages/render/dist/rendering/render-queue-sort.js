import { compareStateAwareRenderRecords } from "./render-state-sort.js";
import { renderQueueSortPolicyForPhase } from "./render-queue-sort-policies.js";
export { batchStaticRenderQueueRecords, coalesceRenderQueueRecords, } from "./render-queue-batching.js";
export { renderQueueSortPolicyForPhase } from "./render-queue-sort-policies.js";
export function sortRenderQueueRecords(records) {
    records.sort(compareRenderQueueRecords);
    return records;
}
export function compareRenderQueueRecords(a, b) {
    return compareStateAwareRenderRecords(a, b) || a.sortOrdinal - b.sortOrdinal;
}
export function writeRenderQueueSortPhases(records, output, pool = []) {
    output.length = 0;
    let opaque = 0;
    let transparent = 0;
    for (const record of records) {
        if (record.queueKind === "transparent") {
            transparent += 1;
        }
        else {
            opaque += 1;
        }
    }
    if (opaque > 0) {
        const phase = sortPhaseAt(pool, output.length);
        phase.phase = "opaque";
        phase.recordCount = opaque;
        phase.sortPolicy = renderQueueSortPolicyForPhase("opaque");
        delete phase.durationUs;
        output.push(phase);
    }
    if (transparent > 0) {
        const phase = sortPhaseAt(pool, output.length);
        phase.phase = "transparent";
        phase.recordCount = transparent;
        phase.sortPolicy = renderQueueSortPolicyForPhase("transparent");
        delete phase.durationUs;
        output.push(phase);
    }
    return output;
}
function sortPhaseAt(pool, index) {
    const existing = pool[index];
    if (existing !== undefined) {
        return existing;
    }
    const phase = {
        phase: "opaque",
        recordCount: 0,
        sortPolicy: renderQueueSortPolicyForPhase("opaque"),
    };
    pool.push(phase);
    return phase;
}
//# sourceMappingURL=render-queue-sort.js.map