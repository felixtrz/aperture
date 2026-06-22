import {
  type MutableRenderQueueSortPhaseReport,
  type RenderQueueRecord,
  type RenderQueueSortPhaseReport,
} from "./render-queue-types.js";
import { compareStateAwareRenderRecords } from "./render-state-sort.js";
import { renderQueueSortPolicyForPhase } from "./render-queue-sort-policies.js";

export {
  batchStaticRenderQueueRecords,
  coalesceRenderQueueRecords,
} from "./render-queue-batching.js";
export { renderQueueSortPolicyForPhase } from "./render-queue-sort-policies.js";

export function sortRenderQueueRecords(
  records: RenderQueueRecord[],
): RenderQueueRecord[] {
  records.sort(compareRenderQueueRecords);
  return records;
}

export function compareRenderQueueRecords(
  a: RenderQueueRecord,
  b: RenderQueueRecord,
): number {
  return compareStateAwareRenderRecords(a, b) || a.sortOrdinal - b.sortOrdinal;
}

export function writeRenderQueueSortPhases(
  records: readonly RenderQueueRecord[],
  output: RenderQueueSortPhaseReport[],
  pool: RenderQueueSortPhaseReport[] = [],
): readonly RenderQueueSortPhaseReport[] {
  output.length = 0;

  let opaque = 0;
  let transparent = 0;

  for (const record of records) {
    if (record.queueKind === "transparent") {
      transparent += 1;
    } else {
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

function sortPhaseAt(
  pool: RenderQueueSortPhaseReport[],
  index: number,
): MutableRenderQueueSortPhaseReport {
  const existing = pool[index] as MutableRenderQueueSortPhaseReport | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const phase: MutableRenderQueueSortPhaseReport = {
    phase: "opaque",
    recordCount: 0,
    sortPolicy: renderQueueSortPolicyForPhase("opaque"),
  };

  pool.push(phase);
  return phase;
}
