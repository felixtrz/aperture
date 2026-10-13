import type {
  MaterialQueueFamily,
  MaterialQueueItem,
} from "./material-queue-types.js";
import { isValidMaterialFamilyKey } from "../materials/index.js";
import type { RenderQueue } from "./snapshot.js";

export const MATERIAL_QUEUE_PHASE_ORDER: readonly RenderQueue[] = [
  "opaque",
  "alpha-test",
  "transparent",
];

export function sortMaterialQueueItems(
  items: MaterialQueueItem[],
): MaterialQueueItem[] {
  items.sort(compareMaterialQueueItems);
  return items;
}

export function materialQueueFamilyFromPipelineKey(
  pipelineKey: string,
): MaterialQueueFamily | null {
  const family = pipelineKey.split("|", 1)[0] ?? "";

  return isMaterialQueueFamilyKey(family) ? family : null;
}

export function materialQueuePhaseRank(phase: RenderQueue): number {
  switch (phase) {
    case "opaque":
      return 0;
    case "alpha-test":
      return 1;
    case "transparent":
      return 2;
  }
}

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isMaterialQueueFamilyKey(
  family: string,
): family is MaterialQueueFamily {
  return isValidMaterialFamilyKey(family);
}

function compareMaterialQueueItems(
  a: MaterialQueueItem,
  b: MaterialQueueItem,
): number {
  const phaseRankDelta =
    materialQueuePhaseRank(a.renderPhase) -
    materialQueuePhaseRank(b.renderPhase);

  if (phaseRankDelta !== 0) {
    return phaseRankDelta;
  }

  if (a.renderPhase === "transparent" || b.renderPhase === "transparent") {
    return (
      a.sortKey.viewId - b.sortKey.viewId ||
      a.sortKey.layer - b.sortKey.layer ||
      a.sortKey.order - b.sortKey.order ||
      b.depth - a.depth ||
      a.sortKey.stableId - b.sortKey.stableId ||
      a.drawIndex - b.drawIndex
    );
  }

  return (
    a.sortKey.viewId - b.sortKey.viewId ||
    a.sortKey.layer - b.sortKey.layer ||
    a.sortKey.order - b.sortKey.order ||
    compareStrings(a.pipelineKey, b.pipelineKey) ||
    compareStrings(a.materialResourceKey, b.materialResourceKey) ||
    compareStrings(a.meshLayoutKey, b.meshLayoutKey) ||
    compareStrings(a.meshResourceKey, b.meshResourceKey) ||
    a.depth - b.depth ||
    a.sortKey.stableId - b.sortKey.stableId ||
    a.drawIndex - b.drawIndex
  );
}
