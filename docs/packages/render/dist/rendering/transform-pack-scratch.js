import { createEmptyInstanceAttributeOffset, createEmptyInstanceTintOffset, createEmptyOffset, } from "./transform-pack-offset-pools.js";
export { ensureInstanceAttributeDataCapacity, ensureInstanceTintDataCapacity, ensurePreviousTransformDataCapacity, ensureTransformDataCapacity, ensureTransformNextDataCapacity, } from "./transform-pack-scratch-capacity.js";
export { instanceAttributeOffsetAt, instanceTintOffsetAt, offsetAt, previousOffsetAt, } from "./transform-pack-offset-pools.js";
export function createPackedSnapshotTransformsScratch(floatCapacity = 0, offsetCapacity = 0) {
    const offsets = [];
    const diagnostics = [];
    const offsetPool = [];
    const data = new Float32Array(floatCapacity);
    const nextData = new Float32Array(floatCapacity);
    for (let i = 0; i < offsetCapacity; i += 1) {
        offsetPool.push(createEmptyOffset());
    }
    return {
        data,
        nextData,
        offsets,
        diagnostics,
        offsetPool,
        sourceOffsets: [],
        sourceOffsetToPackedOffset: new Map(),
        result: { data, floatCount: 0, offsets, diagnostics, contentVersion: 0 },
        lastFloatCount: -1,
        contentVersion: 0,
    };
}
export function createPackedSnapshotPreviousTransformsScratch(floatCapacity = 0, offsetCapacity = 0) {
    const offsets = [];
    const diagnostics = [];
    const offsetPool = [];
    const missing = [];
    const data = new Float32Array(floatCapacity);
    const history = { total: 0, used: 0, fallback: 0, missing };
    for (let i = 0; i < offsetCapacity; i += 1) {
        offsetPool.push(createEmptyOffset());
    }
    return {
        data,
        offsets,
        diagnostics,
        offsetPool,
        missing,
        history,
        result: { data, floatCount: 0, offsets, diagnostics, history },
    };
}
export function createPackedSnapshotInstanceTintsScratch(floatCapacity = 0, offsetCapacity = 0) {
    const offsets = [];
    const diagnostics = [];
    const offsetPool = [];
    const data = new Float32Array(floatCapacity);
    for (let i = 0; i < offsetCapacity; i += 1) {
        offsetPool.push(createEmptyInstanceTintOffset());
    }
    return {
        data,
        offsets,
        diagnostics,
        offsetPool,
        result: { data, floatCount: 0, offsets, diagnostics },
    };
}
export function createPackedSnapshotInstanceAttributesScratch(floatCapacity = 0, offsetCapacity = 0) {
    const offsets = [];
    const diagnostics = [];
    const offsetPool = [];
    const data = new Float32Array(floatCapacity);
    for (let i = 0; i < offsetCapacity; i += 1) {
        offsetPool.push(createEmptyInstanceAttributeOffset());
    }
    return {
        data,
        offsets,
        diagnostics,
        offsetPool,
        result: {
            layout: {
                attributes: [],
                stride: 0,
                strideFloats: 0,
                layoutKey: "",
            },
            data,
            floatCount: 0,
            offsets,
            diagnostics,
        },
    };
}
//# sourceMappingURL=transform-pack-scratch.js.map