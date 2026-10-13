import { createPackedSnapshotInstanceTintsScratch, ensureInstanceTintDataCapacity, instanceTintOffsetAt, } from "./transform-pack-scratch.js";
import { findTransformPackedOffset, hasVec4 } from "./transform-pack-guards.js";
export function packSnapshotInstanceTints(snapshot) {
    const source = snapshot.instanceTints ?? new Float32Array(0);
    const offsets = [];
    const diagnostics = [];
    for (const draw of snapshot.meshDraws) {
        const sourceOffset = draw.instanceTintOffset;
        if (sourceOffset === undefined) {
            continue;
        }
        if (!hasVec4(source, sourceOffset)) {
            diagnostics.push({
                code: "renderInstanceTintPack.missingTint",
                message: `Render id ${draw.renderId} references instance tint offset ${sourceOffset}, but tint buffer length is ${source.length}.`,
                severity: "warning",
                entity: draw.entity,
            });
            continue;
        }
        offsets.push({
            renderId: draw.renderId,
            sourceOffset,
            packedOffset: sourceOffset,
        });
    }
    return {
        data: new Float32Array(source),
        floatCount: source.length,
        offsets,
        diagnostics,
    };
}
export function packSnapshotInstanceTintsForVertexBuffer(snapshot, transforms) {
    return writePackedSnapshotInstanceTintsForVertexBuffer(snapshot, transforms, createPackedSnapshotInstanceTintsScratch());
}
export function writePackedSnapshotInstanceTintsForVertexBuffer(snapshot, transforms, scratch) {
    const result = scratch.result;
    const source = snapshot.instanceTints ?? new Float32Array(0);
    const instanceCount = Math.ceil((transforms.floatCount ?? 0) / 16);
    const requiredFloats = instanceCount * 4;
    scratch.offsets.length = 0;
    scratch.diagnostics.length = 0;
    ensureInstanceTintDataCapacity(scratch, requiredFloats);
    scratch.data.fill(1, 0, requiredFloats);
    for (const draw of snapshot.meshDraws) {
        const sourceOffset = draw.instanceTintOffset;
        if (sourceOffset === undefined) {
            continue;
        }
        if (!hasVec4(source, sourceOffset)) {
            scratch.diagnostics.push({
                code: "renderInstanceTintPack.missingTint",
                message: `Render id ${draw.renderId} references instance tint offset ${sourceOffset}, but tint buffer length is ${source.length}.`,
                severity: "warning",
                entity: draw.entity,
            });
            continue;
        }
        const transformPackedOffset = findTransformPackedOffset(transforms, draw.renderId);
        if (transformPackedOffset === undefined ||
            transformPackedOffset < 0 ||
            transformPackedOffset % 16 !== 0) {
            scratch.diagnostics.push({
                code: "renderInstanceTintPack.missingPackedTransform",
                message: `Render id ${draw.renderId} references instance tint offset ${sourceOffset}, but no aligned packed transform offset was found.`,
                severity: "warning",
                entity: draw.entity,
            });
            continue;
        }
        const packedOffset = (transformPackedOffset / 16) * 4;
        const offset = instanceTintOffsetAt(scratch, scratch.offsets.length);
        scratch.data.set(source.subarray(sourceOffset, sourceOffset + 4), packedOffset);
        offset.renderId = draw.renderId;
        offset.sourceOffset = sourceOffset;
        offset.packedOffset = packedOffset;
        scratch.offsets.push(offset);
    }
    result.data = scratch.data;
    result.floatCount = requiredFloats;
    return scratch.result;
}
//# sourceMappingURL=transform-pack-instance-tints.js.map