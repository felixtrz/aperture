import type {
  RenderEntityRef,
  RenderQueue,
  RenderSortKey,
  RenderSortKeyInput,
} from "./snapshot-types.js";

export function createStableRenderId(entity: RenderEntityRef): number {
  return ((entity.generation & 0xff) << 24) | (entity.index & 0x00ff_ffff);
}

export function createRenderSortKey(input: RenderSortKeyInput): RenderSortKey {
  return {
    queue: input.queue ?? "opaque",
    viewId: input.viewId ?? 0,
    layer: input.layer ?? 0,
    order: input.order ?? 0,
    pipelineKey: input.pipelineKey ?? "",
    materialKey: input.materialKey ?? "",
    meshKey: input.meshKey ?? "",
    depth: input.depth ?? 0,
    stableId: input.stableId,
  };
}

export function compareRenderSortKeys(
  a: RenderSortKey,
  b: RenderSortKey,
): number {
  const baseOrder =
    queueRank(a.queue) - queueRank(b.queue) ||
    a.viewId - b.viewId ||
    a.layer - b.layer ||
    a.order - b.order;

  if (baseOrder !== 0) {
    return baseOrder;
  }

  if (a.queue === "transparent" && b.queue === "transparent") {
    return (
      compareDepth(a, b) ||
      a.stableId - b.stableId ||
      compareStrings(a.pipelineKey, b.pipelineKey) ||
      compareStrings(a.materialKey, b.materialKey) ||
      compareStrings(a.meshKey, b.meshKey)
    );
  }

  return (
    compareStrings(a.pipelineKey, b.pipelineKey) ||
    compareStrings(a.materialKey, b.materialKey) ||
    compareStrings(a.meshKey, b.meshKey) ||
    compareDepth(a, b) ||
    a.stableId - b.stableId
  );
}

function queueRank(queue: RenderQueue): number {
  switch (queue) {
    case "opaque":
      return 0;
    case "alpha-test":
      return 1;
    case "transparent":
      return 2;
  }
}

function compareDepth(a: RenderSortKey, b: RenderSortKey): number {
  if (a.queue === "transparent" || b.queue === "transparent") {
    return b.depth - a.depth;
  }

  return a.depth - b.depth;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
