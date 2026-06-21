import { ensurePreviousTransformDataCapacity, previousOffsetAt, } from "./transform-pack-scratch.js";
import { hasTransformRange } from "./transform-pack-guards.js";
export function writePackedSnapshotPreviousTransforms(currentTransforms, previousByRenderId, scratch) {
    const result = scratch.result;
    const floatCount = currentTransforms.floatCount ?? currentTransforms.data.length;
    scratch.offsets.length = 0;
    scratch.diagnostics.length = 0;
    scratch.missing.length = 0;
    scratch.history.total = currentTransforms.offsets.length;
    scratch.history.used = 0;
    scratch.history.fallback = 0;
    scratch.history.missing = scratch.missing;
    result.floatCount = floatCount;
    ensurePreviousTransformDataCapacity(scratch, floatCount);
    scratch.data.set(currentTransforms.data.subarray(0, floatCount));
    for (const sourceOffset of currentTransforms.offsets) {
        const offset = previousOffsetAt(scratch, scratch.offsets.length);
        offset.renderId = sourceOffset.renderId;
        offset.sourceOffset = sourceOffset.sourceOffset;
        offset.packedOffset = sourceOffset.packedOffset;
        scratch.offsets.push(offset);
        if (!hasTransformRange(floatCount, sourceOffset.packedOffset)) {
            scratch.diagnostics.push({
                code: "renderPreviousTransformPack.missingCurrentTransform",
                message: `Render id ${sourceOffset.renderId} references packed transform offset ${sourceOffset.packedOffset}, but current packed transform data length is ${floatCount}.`,
                severity: "warning",
            });
            scratch.history.fallback += 1;
            scratch.missing.push(sourceOffset.renderId);
            continue;
        }
        const previous = previousByRenderId.get(sourceOffset.renderId);
        if (previous === undefined || previous.length < 16) {
            scratch.history.fallback += 1;
            scratch.missing.push(sourceOffset.renderId);
            continue;
        }
        scratch.data.set(previous.subarray(0, 16), sourceOffset.packedOffset);
        scratch.history.used += 1;
    }
    result.data = scratch.data;
    result.history = scratch.history;
    return scratch.result;
}
export function rememberPackedSnapshotTransformsByRenderId(currentTransforms, previousByRenderId) {
    const seen = new Set();
    const floatCount = currentTransforms.floatCount ?? currentTransforms.data.length;
    let stored = 0;
    for (const offset of currentTransforms.offsets) {
        if (!hasTransformRange(floatCount, offset.packedOffset)) {
            continue;
        }
        const matrix = previousByRenderId.get(offset.renderId) ?? new Float32Array(16);
        matrix.set(currentTransforms.data.subarray(offset.packedOffset, offset.packedOffset + 16));
        previousByRenderId.set(offset.renderId, matrix);
        seen.add(offset.renderId);
        stored += 1;
    }
    let staleRemoved = 0;
    for (const renderId of previousByRenderId.keys()) {
        if (!seen.has(renderId)) {
            previousByRenderId.delete(renderId);
            staleRemoved += 1;
        }
    }
    return { stored, staleRemoved };
}
//# sourceMappingURL=transform-pack-history.js.map