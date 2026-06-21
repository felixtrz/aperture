import { assetHandleKey, toVec4Tuple, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export function createMaterialSlots(input) {
    return {
        slotsJson: JSON.stringify(input.slots.map((slot) => ({
            slot: Math.trunc(slot.slot),
            materialId: assetHandleKey(slot.material),
        }))),
    };
}
export function createInstanceTint(input = {}) {
    return {
        color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
    };
}
export function createInstanceData(input) {
    return {
        materialKind: input.materialKind,
        valuesJson: JSON.stringify(input.values),
    };
}
export function createSkin(input) {
    const jointMatrices = Float32Array.from(input.jointMatrices);
    return {
        jointCount: Math.floor(jointMatrices.length / 16),
        jointMatrices,
    };
}
export function createMorphTargetWeights(input) {
    const weights = Float32Array.from(input.weights);
    return {
        targetCount: weights.length,
        weights,
    };
}
//# sourceMappingURL=authoring-create-mesh-data.js.map