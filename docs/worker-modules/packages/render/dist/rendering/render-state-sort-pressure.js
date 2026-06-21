import { OPAQUE_STATE_SORT_POLICY_NAME } from "./render-state-sort-types.js";
export function createOpaqueRenderStateSortPressureReport(input) {
    return {
        phase: "opaque",
        policy: OPAQUE_STATE_SORT_POLICY_NAME,
        recordCount: input.recordCount,
        stableOrder: input.stableOrder,
        stateAwareOrder: input.stateAwareOrder,
        delta: subtractSwitchCounts(input.stableOrder, input.stateAwareOrder),
    };
}
export function emptyOpaqueRenderStateSortPressureReport() {
    const empty = emptySwitchCounts();
    return createOpaqueRenderStateSortPressureReport({
        stableOrder: empty,
        stateAwareOrder: empty,
        recordCount: 0,
    });
}
export function countOpaqueRenderStateSwitches(records) {
    const counts = {
        pipeline: 0,
        materialResource: 0,
        meshLayout: 0,
        meshResource: 0,
        total: 0,
    };
    let lastPipeline = null;
    let lastMaterialResource = null;
    let lastMeshLayout = null;
    let lastMeshResource = null;
    for (const record of records) {
        if (record.sortKey.queue === "transparent") {
            continue;
        }
        if (record.batchKey.pipelineKey !== lastPipeline) {
            counts.pipeline += 1;
            lastPipeline = record.batchKey.pipelineKey;
        }
        if (record.materialResourceKey !== lastMaterialResource) {
            counts.materialResource += 1;
            lastMaterialResource = record.materialResourceKey;
        }
        if (record.batchKey.meshLayoutKey !== lastMeshLayout) {
            counts.meshLayout += 1;
            lastMeshLayout = record.batchKey.meshLayoutKey;
        }
        if (record.meshResourceKey !== lastMeshResource) {
            counts.meshResource += 1;
            lastMeshResource = record.meshResourceKey;
        }
    }
    counts.total =
        counts.pipeline +
            counts.materialResource +
            counts.meshLayout +
            counts.meshResource;
    return counts;
}
export function countOpaqueRenderStateRecords(records) {
    let count = 0;
    for (const record of records) {
        if (record.sortKey.queue !== "transparent") {
            count += 1;
        }
    }
    return count;
}
function subtractSwitchCounts(stableOrder, stateAwareOrder) {
    return {
        pipeline: stableOrder.pipeline - stateAwareOrder.pipeline,
        materialResource: stableOrder.materialResource - stateAwareOrder.materialResource,
        meshLayout: stableOrder.meshLayout - stateAwareOrder.meshLayout,
        meshResource: stableOrder.meshResource - stateAwareOrder.meshResource,
        total: stableOrder.total - stateAwareOrder.total,
    };
}
function emptySwitchCounts() {
    return {
        pipeline: 0,
        materialResource: 0,
        meshLayout: 0,
        meshResource: 0,
        total: 0,
    };
}
//# sourceMappingURL=render-state-sort-pressure.js.map