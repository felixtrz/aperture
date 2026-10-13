export function createMaterialQueueScratch(capacity = 0) {
    const itemPool = [];
    const items = [];
    const diagnostics = [];
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
export function materialQueueItemAt(scratch, index) {
    const existing = scratch.itemPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const item = createEmptyMaterialQueueItem();
    scratch.itemPool.push(item);
    return item;
}
function createEmptyMaterialQueueItem() {
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
//# sourceMappingURL=material-queue-scratch.js.map