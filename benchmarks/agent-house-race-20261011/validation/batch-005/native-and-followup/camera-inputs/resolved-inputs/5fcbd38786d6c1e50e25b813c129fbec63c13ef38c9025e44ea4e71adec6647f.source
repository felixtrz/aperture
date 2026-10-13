export function required(value) {
    if (value === undefined) {
        throw new Error("Expected mesh merge value to exist after validation.");
    }
    return value;
}
export function requiredElementCount(stream) {
    return ((stream.vertexCount * stream.arrayStride) / stream.data.BYTES_PER_ELEMENT);
}
export function attributesMatch(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        const left = a[index];
        const right = b[index];
        if (left === undefined ||
            right === undefined ||
            left.semantic !== right.semantic ||
            left.format !== right.format ||
            left.offset !== right.offset) {
            return false;
        }
    }
    return true;
}
export function dataConstructorsMatch(a, b) {
    return ((a instanceof Float32Array && b instanceof Float32Array) ||
        (a instanceof Uint16Array && b instanceof Uint16Array) ||
        (a instanceof Uint8Array && b instanceof Uint8Array));
}
export function createVertexDataArray(sample, length) {
    if (sample instanceof Float32Array) {
        return new Float32Array(length);
    }
    if (sample instanceof Uint16Array) {
        return new Uint16Array(length);
    }
    return new Uint8Array(length);
}
export function setVertexData(target, source, offset) {
    if (target instanceof Float32Array && source instanceof Float32Array) {
        target.set(source, offset);
        return;
    }
    if (target instanceof Uint16Array && source instanceof Uint16Array) {
        target.set(source, offset);
        return;
    }
    if (target instanceof Uint8Array && source instanceof Uint8Array) {
        target.set(source, offset);
    }
}
export function materialSlotsMatch(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        const left = a[index];
        const right = b[index];
        if (left === undefined ||
            right === undefined ||
            left.index !== right.index ||
            left.label !== right.label) {
            return false;
        }
    }
    return true;
}
export function cloneMaterialSlots(materialSlots) {
    return materialSlots.map((slot) => ({ ...slot }));
}
//# sourceMappingURL=mesh-merge-utils.js.map