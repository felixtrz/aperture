import { DEFAULT_RENDER_QUEUE_PASS_ID, DEFAULT_RENDER_QUEUE_VIEW_ID, } from "./render-queue-types.js";
import { renderQueueSortPolicyForPhase } from "./render-queue-sort.js";
export function createRenderQueueScratch(capacity = 0) {
    const recordPool = [];
    const records = [];
    const diagnostics = [];
    const sortPhases = [];
    const sortPhasePool = [
        {
            phase: "opaque",
            recordCount: 0,
            sortPolicy: renderQueueSortPolicyForPhase("opaque"),
        },
        {
            phase: "transparent",
            recordCount: 0,
            sortPolicy: renderQueueSortPolicyForPhase("transparent"),
        },
    ];
    for (let i = 0; i < capacity; i += 1) {
        recordPool.push(createEmptyRenderQueueRecord());
    }
    return {
        records,
        diagnostics,
        sortPhases,
        sortPhasePool,
        recordPool,
        plan: { records, diagnostics, sortPhases },
    };
}
export function renderQueueRecordAt(scratch, index) {
    const existing = scratch.recordPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const record = createEmptyRenderQueueRecord();
    scratch.recordPool.push(record);
    return record;
}
function createEmptyRenderQueueRecord() {
    return {
        renderId: 0,
        sortOrdinal: 0,
        viewId: DEFAULT_RENDER_QUEUE_VIEW_ID,
        passId: DEFAULT_RENDER_QUEUE_PASS_ID,
        queueKind: "opaque",
        packet: null,
        submesh: 0,
        materialSlot: 0,
        meshResourceKey: "",
        materialResourceKey: "",
        pipelineKey: "",
        materialKey: "",
        meshLayoutKey: "",
        batchKey: null,
        sortKey: null,
        transformPackedOffset: 0,
        instanceCount: 1,
        drawKind: "single",
        sourceRecordCount: 1,
        sourceRenderIds: [],
        sourceMeshResourceKeys: [],
    };
}
//# sourceMappingURL=render-queue-scratch.js.map