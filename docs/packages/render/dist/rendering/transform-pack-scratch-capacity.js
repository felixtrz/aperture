export function ensureTransformDataCapacity(scratch, required) {
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
export function ensureTransformNextDataCapacity(scratch, required) {
    if (scratch.nextData.length >= required) {
        return;
    }
    let capacity = Math.max(16, scratch.nextData.length);
    while (capacity < required) {
        capacity *= 2;
    }
    scratch.nextData = new Float32Array(capacity);
}
export function ensurePreviousTransformDataCapacity(scratch, required) {
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
export function ensureInstanceTintDataCapacity(scratch, required) {
    if (scratch.data.length >= required) {
        return;
    }
    let capacity = Math.max(4, scratch.data.length);
    while (capacity < required) {
        capacity *= 2;
    }
    scratch.data = new Float32Array(capacity);
}
export function ensureInstanceAttributeDataCapacity(scratch, required) {
    if (scratch.data.length >= required) {
        return;
    }
    let capacity = Math.max(4, scratch.data.length);
    while (capacity < required) {
        capacity *= 2;
    }
    scratch.data = new Float32Array(capacity);
}
//# sourceMappingURL=transform-pack-scratch-capacity.js.map