export function offsetAt(scratch, index) {
    const existing = scratch.offsetPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const offset = createEmptyOffset();
    scratch.offsetPool.push(offset);
    return offset;
}
export function previousOffsetAt(scratch, index) {
    const existing = scratch.offsetPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const offset = createEmptyOffset();
    scratch.offsetPool.push(offset);
    return offset;
}
export function instanceTintOffsetAt(scratch, index) {
    const existing = scratch.offsetPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const offset = createEmptyInstanceTintOffset();
    scratch.offsetPool.push(offset);
    return offset;
}
export function instanceAttributeOffsetAt(scratch, index) {
    const existing = scratch.offsetPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const offset = createEmptyInstanceAttributeOffset();
    scratch.offsetPool.push(offset);
    return offset;
}
export function createEmptyOffset() {
    return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}
export function createEmptyInstanceTintOffset() {
    return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}
export function createEmptyInstanceAttributeOffset() {
    return { renderId: 0, sourcePacketIndex: 0, packedOffset: 0 };
}
//# sourceMappingURL=transform-pack-offset-pools.js.map