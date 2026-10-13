export function coalesceRenderQueueRecords(records) {
    if (records.length < 2) {
        return records;
    }
    let writeIndex = 1;
    for (let readIndex = 1; readIndex < records.length; readIndex += 1) {
        const previous = records[writeIndex - 1];
        const record = records[readIndex];
        if (previous === undefined || record === undefined) {
            continue;
        }
        if (canCoalesceRenderQueueRecord(previous, record)) {
            previous.instanceCount += record.instanceCount;
            previous.drawKind = "instanced";
            previous.sourceRecordCount += record.sourceRecordCount;
            appendSources(previous, record);
            continue;
        }
        records[writeIndex] = record;
        writeIndex += 1;
    }
    records.length = writeIndex;
    return records;
}
export function batchStaticRenderQueueRecords(records, options) {
    if (!options?.enabled || records.length < 2) {
        return records;
    }
    const maxRecordsPerBatch = Math.max(1, Math.floor(options.maxRecordsPerBatch ?? 4));
    let writeIndex = 1;
    for (let readIndex = 1; readIndex < records.length; readIndex += 1) {
        const previous = records[writeIndex - 1];
        const record = records[readIndex];
        if (previous === undefined || record === undefined) {
            continue;
        }
        if (canBatchStaticRenderQueueRecord(previous, record, maxRecordsPerBatch)) {
            previous.drawKind = "static-merged";
            previous.sourceRecordCount += record.sourceRecordCount;
            appendSources(previous, record);
            continue;
        }
        records[writeIndex] = record;
        writeIndex += 1;
    }
    records.length = writeIndex;
    return records;
}
function canCoalesceRenderQueueRecord(previous, record) {
    return (previous.queueKind !== "transparent" &&
        record.queueKind !== "transparent" &&
        previous.viewId === record.viewId &&
        previous.passId === record.passId &&
        previous.queueKind === record.queueKind &&
        previous.meshResourceKey === record.meshResourceKey &&
        previous.materialResourceKey === record.materialResourceKey &&
        previous.pipelineKey === record.pipelineKey &&
        previous.materialKey === record.materialKey &&
        previous.meshLayoutKey === record.meshLayoutKey &&
        batchKeysMatch(previous.batchKey, record.batchKey) &&
        drawRangesMatch(previous, record) &&
        previous.transformPackedOffset + previous.instanceCount * 16 ===
            record.transformPackedOffset);
}
function canBatchStaticRenderQueueRecord(previous, record, maxRecordsPerBatch) {
    return (maxRecordsPerBatch > 1 &&
        previous.queueKind === "opaque" &&
        record.queueKind === "opaque" &&
        previous.drawKind !== "instanced" &&
        record.drawKind === "single" &&
        previous.instanceCount === 1 &&
        record.instanceCount === 1 &&
        previous.sourceRecordCount + record.sourceRecordCount <=
            maxRecordsPerBatch &&
        previous.viewId === record.viewId &&
        previous.passId === record.passId &&
        previous.meshResourceKey !== record.meshResourceKey &&
        previous.materialResourceKey === record.materialResourceKey &&
        previous.pipelineKey === record.pipelineKey &&
        previous.materialKey === record.materialKey &&
        previous.meshLayoutKey === record.meshLayoutKey &&
        batchKeysMatch(previous.batchKey, record.batchKey) &&
        !previous.batchKey.instanced &&
        !previous.batchKey.skinned &&
        !previous.batchKey.morphed);
}
function appendSources(previous, record) {
    for (const renderId of record.sourceRenderIds) {
        previous.sourceRenderIds.push(renderId);
    }
    for (const meshResourceKey of record.sourceMeshResourceKeys) {
        previous.sourceMeshResourceKeys.push(meshResourceKey);
    }
}
function batchKeysMatch(a, b) {
    return (a.pipelineKey === b.pipelineKey &&
        a.materialKey === b.materialKey &&
        a.meshLayoutKey === b.meshLayoutKey &&
        a.topology === b.topology &&
        a.instanced === b.instanced &&
        a.skinned === b.skinned &&
        a.morphed === b.morphed);
}
function drawRangesMatch(a, b) {
    return (a.submesh === b.submesh &&
        a.materialSlot === b.materialSlot &&
        a.vertexStart === b.vertexStart &&
        a.vertexCount === b.vertexCount &&
        a.indexStart === b.indexStart &&
        a.indexCount === b.indexCount);
}
//# sourceMappingURL=render-queue-batching.js.map