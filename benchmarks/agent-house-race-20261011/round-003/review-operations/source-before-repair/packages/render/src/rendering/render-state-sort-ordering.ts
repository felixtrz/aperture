import type { RenderQueue, RenderSortKey } from "./snapshot.js";
import type { RenderStateSortRecord } from "./render-state-sort-types.js";

export function compareStableRenderRecords(
  a: RenderStateSortRecord,
  b: RenderStateSortRecord,
): number {
  const phaseOrder =
    stableRenderQueuePhaseRank(a.sortKey.queue) -
    stableRenderQueuePhaseRank(b.sortKey.queue);

  if (phaseOrder !== 0) {
    return phaseOrder;
  }

  const authorOrder =
    a.sortKey.viewId - b.sortKey.viewId ||
    a.sortKey.layer - b.sortKey.layer ||
    a.sortKey.order - b.sortKey.order;

  if (authorOrder !== 0) {
    return authorOrder;
  }

  if (a.sortKey.queue === "transparent" && b.sortKey.queue === "transparent") {
    return (
      compareDepth(a.sortKey, b.sortKey) ||
      a.sortKey.stableId - b.sortKey.stableId ||
      a.renderId - b.renderId
    );
  }

  return (
    a.sortKey.stableId - b.sortKey.stableId ||
    a.renderId - b.renderId ||
    compareDepth(a.sortKey, b.sortKey)
  );
}

export function compareStateAwareRenderRecords(
  a: RenderStateSortRecord,
  b: RenderStateSortRecord,
): number {
  const phaseOrder =
    renderQueuePhaseRank(a.sortKey.queue) -
    renderQueuePhaseRank(b.sortKey.queue);

  if (phaseOrder !== 0) {
    return phaseOrder;
  }

  const authorOrder =
    a.sortKey.viewId - b.sortKey.viewId ||
    a.sortKey.layer - b.sortKey.layer ||
    a.sortKey.order - b.sortKey.order;

  if (authorOrder !== 0) {
    return authorOrder;
  }

  if (a.sortKey.queue === "transparent" && b.sortKey.queue === "transparent") {
    return (
      b.sortKey.depth - a.sortKey.depth ||
      a.sortKey.stableId - b.sortKey.stableId ||
      compareStrings(a.batchKey.pipelineKey, b.batchKey.pipelineKey) ||
      compareStrings(a.materialResourceKey, b.materialResourceKey) ||
      compareStrings(a.batchKey.meshLayoutKey, b.batchKey.meshLayoutKey) ||
      compareStrings(a.meshResourceKey, b.meshResourceKey) ||
      a.renderId - b.renderId
    );
  }

  return (
    compareStrings(a.batchKey.pipelineKey, b.batchKey.pipelineKey) ||
    compareStrings(a.materialResourceKey, b.materialResourceKey) ||
    compareStrings(a.batchKey.meshLayoutKey, b.batchKey.meshLayoutKey) ||
    compareStrings(a.meshResourceKey, b.meshResourceKey) ||
    a.sortKey.depth - b.sortKey.depth ||
    a.sortKey.stableId - b.sortKey.stableId ||
    a.renderId - b.renderId
  );
}

function renderQueuePhaseRank(phase: RenderQueue): number {
  switch (phase) {
    case "opaque":
      return 0;
    case "alpha-test":
      return 1;
    case "transparent":
      return 2;
  }
}

function stableRenderQueuePhaseRank(phase: RenderQueue): number {
  return phase === "transparent" ? 1 : 0;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDepth(a: RenderSortKey, b: RenderSortKey): number {
  return a.queue === "transparent" || b.queue === "transparent"
    ? b.depth - a.depth
    : a.depth - b.depth;
}
