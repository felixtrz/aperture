import { toVec2Tuple as tuple2, toVec3Tuple as tuple3, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export { tuple2, tuple3 };
export function entityRef(entity) {
    return { index: entity.index, generation: entity.generation };
}
export function normalizeTuple3(values) {
    const x = values[0];
    const y = values[1];
    const z = values[2];
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length <= 1e-8) {
        return [0, 0, 0];
    }
    return [x / length, y / length, z / length];
}
export function distanceBetween(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
//# sourceMappingURL=math.js.map