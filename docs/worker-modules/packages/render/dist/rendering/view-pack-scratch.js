export function createPackedSnapshotViewUniformsScratch(floatCapacity = 0, viewCapacity = 0) {
    const data = new Float32Array(floatCapacity);
    const views = [];
    const diagnostics = [];
    const viewPool = [];
    for (let index = 0; index < viewCapacity; index += 1) {
        viewPool.push(createEmptyViewRecord());
    }
    return {
        data,
        views,
        diagnostics,
        viewPool,
        seenViewIds: new Set(),
        result: { data, floatCount: 0, views, diagnostics, contentVersion: 0 },
        previous: new Float32Array(0),
        lastFloatCount: -1,
        contentVersion: 0,
    };
}
export function ensureViewUniformDataCapacity(scratch, required) {
    if (scratch.data.length >= required) {
        return;
    }
    let capacity = Math.max(16, scratch.data.length);
    while (capacity < required) {
        capacity *= 2;
    }
    const next = new Float32Array(capacity);
    next.set(scratch.data.subarray(0, scratch.data.length));
    scratch.data = next;
}
export function viewRecordAt(scratch, index) {
    const existing = scratch.viewPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const record = createEmptyViewRecord();
    scratch.viewPool.push(record);
    return record;
}
function createEmptyViewRecord() {
    return { viewId: 0, sourceOffset: 0, packedOffset: 0 };
}
//# sourceMappingURL=view-pack-scratch.js.map