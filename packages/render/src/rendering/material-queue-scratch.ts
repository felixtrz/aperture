import type {
  MaterialQueueItem,
  MaterialQueueScratch,
  MutableMaterialQueueItem,
} from "./material-queue-types.js";

export function createMaterialQueueScratch(capacity = 0): MaterialQueueScratch {
  const itemPool: MaterialQueueItem[] = [];
  const items: MaterialQueueItem[] = [];
  const diagnostics: MaterialQueueScratch["diagnostics"] = [];

  for (let i = 0; i < capacity; i += 1) {
    itemPool.push(createEmptyMaterialQueueItem());
  }

  return {
    items,
    diagnostics,
    itemPool,
    plan: { items, diagnostics },
  };
}

export function materialQueueItemAt(
  scratch: MaterialQueueScratch,
  index: number,
): MutableMaterialQueueItem {
  const existing = scratch.itemPool[index] as
    | MutableMaterialQueueItem
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const item = createEmptyMaterialQueueItem();

  scratch.itemPool.push(item);
  return item;
}

function createEmptyMaterialQueueItem(): MutableMaterialQueueItem {
  return {
    renderId: 0,
    drawIndex: 0,
    entity: { index: 0, generation: 0 },
    submesh: 0,
    materialSlot: 0,
    renderPhase: "opaque",
    materialFamily: "unlit",
    pipelineKey: "",
    meshKey: "",
    materialKey: "",
    meshResourceKey: "",
    materialResourceKey: "",
    meshLayoutKey: "",
    topology: "triangle-list",
    depth: 0,
    sortKey: {
      renderPhase: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "",
      materialResourceKey: "",
      meshResourceKey: "",
      depth: 0,
      stableId: 0,
      drawIndex: 0,
    },
  };
}
