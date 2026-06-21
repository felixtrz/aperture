import { DEFAULT_RENDER_QUEUE_PASS_ID, DEFAULT_RENDER_QUEUE_VIEW_ID, } from "./render-queue-types.js";
import { createRenderQueueScratch, renderQueueRecordAt, } from "./render-queue-scratch.js";
import { batchStaticRenderQueueRecords, coalesceRenderQueueRecords, sortRenderQueueRecords, writeRenderQueueSortPhases, } from "./render-queue-sort.js";
export { DEFAULT_RENDER_QUEUE_PASS_ID, DEFAULT_RENDER_QUEUE_VIEW_ID, } from "./render-queue-types.js";
export { createRenderQueueScratch } from "./render-queue-scratch.js";
export { batchStaticRenderQueueRecords, coalesceRenderQueueRecords, compareRenderQueueRecords, renderQueueSortPolicyForPhase, sortRenderQueueRecords, writeRenderQueueSortPhases, } from "./render-queue-sort.js";
export function planRenderQueueRecords(readiness, transforms, options) {
    const scratch = createRenderQueueScratch();
    writeRenderQueueRecords(readiness, transforms, scratch, options);
    return scratch.plan;
}
export function writeRenderQueueRecords(readiness, transforms, scratch, options) {
    writeUnsortedRenderQueueRecords(readiness, transforms, scratch, options);
    sortRenderQueueRecords(scratch.records);
    coalesceRenderQueueRecords(scratch.records);
    batchStaticRenderQueueRecords(scratch.records, options?.staticBatching);
    writeRenderQueueSortPhases(scratch.records, scratch.sortPhases, scratch.sortPhasePool);
    return scratch.plan;
}
export function writeUnsortedRenderQueueRecords(readiness, transforms, scratch, options) {
    const viewId = options?.scope?.viewId ?? DEFAULT_RENDER_QUEUE_VIEW_ID;
    const passId = options?.scope?.passId ?? DEFAULT_RENDER_QUEUE_PASS_ID;
    const queueKindOverride = options?.scope?.queueKind;
    scratch.records.length = 0;
    scratch.diagnostics.length = 0;
    scratch.sortPhases.length = 0;
    for (const diagnostic of transforms.diagnostics) {
        scratch.diagnostics.push(diagnostic);
    }
    for (const blocked of readiness.blocked) {
        scratch.diagnostics.push({
            code: "renderDrawPackage.blockedDraw",
            message: `Render object ${blocked.renderId} is blocked by missing resources: ${blocked.missing.join(", ")}.`,
            severity: "warning",
            entity: blocked.packet.entity,
        });
    }
    for (const draw of readiness.ready) {
        const transformPackedOffset = findPackedTransformOffset(transforms, draw.renderId);
        if (transformPackedOffset === undefined) {
            scratch.diagnostics.push({
                code: "renderDrawPackage.missingPackedTransform",
                message: `Render object ${draw.renderId} is ready but has no packed transform offset.`,
                severity: "warning",
                entity: draw.packet.entity,
            });
            continue;
        }
        const record = renderQueueRecordAt(scratch, scratch.records.length);
        record.renderId = draw.renderId;
        record.sortOrdinal = scratch.records.length;
        record.viewId = viewId;
        record.passId = passId;
        record.queueKind =
            queueKindOverride ?? renderQueueKindFromSortKey(draw.packet.sortKey);
        record.packet = draw.packet;
        record.submesh = draw.packet.submesh;
        record.materialSlot = draw.packet.materialSlot;
        assignOptionalNumber(record, "vertexStart", draw.packet.vertexStart);
        assignOptionalNumber(record, "vertexCount", draw.packet.vertexCount);
        assignOptionalNumber(record, "indexStart", draw.packet.indexStart);
        assignOptionalNumber(record, "indexCount", draw.packet.indexCount);
        record.meshResourceKey = draw.meshResourceKey;
        record.materialResourceKey = draw.materialResourceKey;
        record.pipelineKey = draw.batchKey.pipelineKey;
        record.materialKey = draw.batchKey.materialKey;
        record.meshLayoutKey = draw.batchKey.meshLayoutKey;
        record.batchKey = draw.batchKey;
        record.sortKey = draw.packet.sortKey;
        record.transformPackedOffset = transformPackedOffset;
        record.instanceCount = 1;
        record.drawKind = "single";
        record.sourceRecordCount = 1;
        record.sourceRenderIds.length = 0;
        record.sourceRenderIds.push(draw.renderId);
        record.sourceMeshResourceKeys.length = 0;
        record.sourceMeshResourceKeys.push(draw.meshResourceKey);
        scratch.records.push(record);
    }
    return scratch.plan;
}
function findPackedTransformOffset(transforms, renderId) {
    for (const offset of transforms.offsets) {
        if (offset.renderId === renderId) {
            return offset.packedOffset;
        }
    }
    return undefined;
}
function renderQueueKindFromSortKey(sortKey) {
    return sortKey.queue === "transparent" ? "transparent" : "opaque";
}
function assignOptionalNumber(target, key, value) {
    if (value === undefined) {
        delete target[key];
        return;
    }
    target[key] = value;
}
//# sourceMappingURL=render-queue.js.map