import {
  MATERIAL_QUEUE_PHASE_ORDER,
  compareStrings,
  materialQueuePhaseRank,
} from "./material-queue-ordering.js";
import type {
  MaterialQueueFamily,
  MaterialQueueItem,
  MaterialQueuePhaseSummary,
} from "./material-queue-types.js";
import type { RenderQueue } from "./snapshot.js";

export function createMaterialQueuePhaseSummary(
  items: readonly MaterialQueueItem[],
): MaterialQueuePhaseSummary {
  const phaseCounts = new Map<RenderQueue, number>();
  const familyCounts = new Map<MaterialQueueFamily, number>();
  const phaseFamilyCounts = new Map<
    string,
    { phase: RenderQueue; family: MaterialQueueFamily; itemCount: number }
  >();

  for (const item of items) {
    phaseCounts.set(
      item.renderPhase,
      (phaseCounts.get(item.renderPhase) ?? 0) + 1,
    );
    familyCounts.set(
      item.materialFamily,
      (familyCounts.get(item.materialFamily) ?? 0) + 1,
    );

    const phaseFamilyKey = `${item.renderPhase}|${item.materialFamily}`;
    const phaseFamilyCount = phaseFamilyCounts.get(phaseFamilyKey);

    if (phaseFamilyCount === undefined) {
      phaseFamilyCounts.set(phaseFamilyKey, {
        phase: item.renderPhase,
        family: item.materialFamily,
        itemCount: 1,
      });
    } else {
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
      .sort(
        (a, b) =>
          materialQueuePhaseRank(a.phase) - materialQueuePhaseRank(b.phase) ||
          compareStrings(a.family, b.family),
      )
      .map(({ phase, family, itemCount }) => ({ phase, family, itemCount })),
  };
}
