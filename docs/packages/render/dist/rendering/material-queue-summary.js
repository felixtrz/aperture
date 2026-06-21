import { MATERIAL_QUEUE_PHASE_ORDER, compareStrings, materialQueuePhaseRank, } from "./material-queue-ordering.js";
export function createMaterialQueuePhaseSummary(items) {
    const phaseCounts = new Map();
    const familyCounts = new Map();
    const phaseFamilyCounts = new Map();
    for (const item of items) {
        phaseCounts.set(item.renderPhase, (phaseCounts.get(item.renderPhase) ?? 0) + 1);
        familyCounts.set(item.materialFamily, (familyCounts.get(item.materialFamily) ?? 0) + 1);
        const phaseFamilyKey = `${item.renderPhase}|${item.materialFamily}`;
        const phaseFamilyCount = phaseFamilyCounts.get(phaseFamilyKey);
        if (phaseFamilyCount === undefined) {
            phaseFamilyCounts.set(phaseFamilyKey, {
                phase: item.renderPhase,
                family: item.materialFamily,
                itemCount: 1,
            });
        }
        else {
            phaseFamilyCount.itemCount += 1;
        }
    }
    return {
        itemCount: items.length,
        byPhase: MATERIAL_QUEUE_PHASE_ORDER.flatMap((phase) => {
            const itemCount = phaseCounts.get(phase);
            return itemCount === undefined ? [] : [{ phase, itemCount }];
        }),
        byFamily: [...familyCounts.entries()]
            .sort(([a], [b]) => compareStrings(a, b))
            .map(([family, itemCount]) => ({ family, itemCount })),
        byPhaseAndFamily: [...phaseFamilyCounts.values()]
            .sort((a, b) => materialQueuePhaseRank(a.phase) - materialQueuePhaseRank(b.phase) ||
            compareStrings(a.family, b.family))
            .map(({ phase, family, itemCount }) => ({ phase, family, itemCount })),
    };
}
//# sourceMappingURL=material-queue-summary.js.map