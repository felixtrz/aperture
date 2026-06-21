import { ensureViewUniformDataCapacity, viewRecordAt, } from "./view-pack-scratch.js";
import { PACKED_VIEW_UNIFORM_FLOAT_STRIDE, VIEW_CAMERA_POSITION_FLOAT_OFFSET, VIEW_FOG_COLOR_FLOAT_OFFSET, VIEW_FOG_PARAMS_FLOAT_OFFSET, VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET, VIEW_PROJECTION_FLOAT_COUNT, } from "./view-pack-types.js";
import { hasMatrixRange, writeCameraPosition, writeFogParameters, writePreviousViewProjection, } from "./view-pack-writers.js";
export function writePackedSnapshotViewUniforms(snapshot, scratch, options = {}) {
    const result = scratch.result;
    scratch.views.length = 0;
    scratch.diagnostics.length = 0;
    scratch.seenViewIds.clear();
    result.floatCount = 0;
    if (snapshot.views.length === 0) {
        scratch.diagnostics.push({
            code: "viewUniform.emptySnapshot",
            message: "Render snapshot has no views to pack.",
        });
        result.data = scratch.data;
        finishViewUniformDirtyTracking(scratch, result);
        return scratch.result;
    }
    for (const view of snapshot.views) {
        if (scratch.seenViewIds.has(view.viewId)) {
            scratch.diagnostics.push({
                code: "viewUniform.duplicateViewId",
                viewId: view.viewId,
                message: `Duplicate view id ${view.viewId} in render snapshot.`,
            });
            continue;
        }
        scratch.seenViewIds.add(view.viewId);
        const sourceOffset = view.viewProjectionMatrixOffset;
        if (snapshot.viewMatrices.length === 0) {
            scratch.diagnostics.push({
                code: "viewUniform.missingMatrixData",
                viewId: view.viewId,
                sourceOffset,
                message: `View ${view.viewId} cannot be packed because snapshot view matrix data is empty.`,
            });
            continue;
        }
        if (!hasMatrixRange(snapshot.viewMatrices, sourceOffset)) {
            scratch.diagnostics.push({
                code: "viewUniform.matrixOutOfRange",
                viewId: view.viewId,
                sourceOffset,
                message: `View ${view.viewId} view-projection matrix offset ${sourceOffset} is outside snapshot view matrix data.`,
            });
            continue;
        }
        if (!hasMatrixRange(snapshot.viewMatrices, view.viewMatrixOffset)) {
            scratch.diagnostics.push({
                code: "viewUniform.matrixOutOfRange",
                viewId: view.viewId,
                sourceOffset: view.viewMatrixOffset,
                message: `View ${view.viewId} view matrix offset ${view.viewMatrixOffset} is outside snapshot view matrix data.`,
            });
            continue;
        }
        const packedOffset = result.floatCount;
        ensureViewUniformDataCapacity(scratch, result.floatCount + PACKED_VIEW_UNIFORM_FLOAT_STRIDE);
        for (let index = 0; index < VIEW_PROJECTION_FLOAT_COUNT; index += 1) {
            scratch.data[result.floatCount + index] =
                snapshot.viewMatrices[sourceOffset + index] ?? 0;
        }
        writeCameraPosition(scratch.data, result.floatCount + VIEW_CAMERA_POSITION_FLOAT_OFFSET, snapshot.viewMatrices, view.viewMatrixOffset);
        writePreviousViewProjection(scratch.data, result.floatCount + VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET, snapshot.viewMatrices, view, options.previousViewProjectionByViewId);
        writeFogParameters(scratch.data, result.floatCount + VIEW_FOG_COLOR_FLOAT_OFFSET, result.floatCount + VIEW_FOG_PARAMS_FLOAT_OFFSET, snapshot.fogs ?? [], view);
        const record = viewRecordAt(scratch, scratch.views.length);
        record.viewId = view.viewId;
        record.sourceOffset = sourceOffset;
        record.packedOffset = packedOffset;
        scratch.views.push(record);
        result.floatCount += PACKED_VIEW_UNIFORM_FLOAT_STRIDE;
    }
    result.data = scratch.data;
    finishViewUniformDirtyTracking(scratch, result);
    return scratch.result;
}
/**
 * AI-65: diff the freshly packed view-uniform floats against the previous
 * frame's copy held on the scratch, publishing the same contentVersion /
 * dirtyRange contract as the transform packer (null = byte-identical, full
 * when there is no comparable history), then refresh the previous copy.
 */
function finishViewUniformDirtyTracking(scratch, result) {
    const floatCount = result.floatCount;
    const comparable = scratch.lastFloatCount === floatCount &&
        scratch.previous.length >= floatCount;
    let dirtyRange;
    if (!comparable) {
        dirtyRange =
            floatCount === 0 && scratch.lastFloatCount === 0
                ? null
                : floatCount === 0
                    ? null
                    : { floatOffset: 0, floatCount, full: true };
    }
    else {
        let first = -1;
        for (let index = 0; index < floatCount; index += 1) {
            if (scratch.previous[index] !== scratch.data[index]) {
                first = index;
                break;
            }
        }
        if (first === -1) {
            dirtyRange = null;
        }
        else {
            let last = first;
            for (let index = floatCount - 1; index > first; index -= 1) {
                if (scratch.previous[index] !== scratch.data[index]) {
                    last = index;
                    break;
                }
            }
            dirtyRange = {
                floatOffset: first,
                floatCount: last - first + 1,
                full: false,
            };
        }
    }
    if (scratch.previous.length < floatCount) {
        scratch.previous = new Float32Array(scratch.data.length);
    }
    scratch.previous.set(scratch.data.subarray(0, floatCount));
    scratch.lastFloatCount = floatCount;
    if (dirtyRange !== null) {
        scratch.contentVersion += 1;
    }
    result.dirtyRange = dirtyRange;
    result.contentVersion = scratch.contentVersion;
}
//# sourceMappingURL=view-pack-write.js.map