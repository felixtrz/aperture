export function mergeBounds(meshes) {
    const bounds = meshes.flatMap((mesh) => mesh.localAabb === undefined ? [] : [mesh.localAabb]);
    if (bounds.length !== meshes.length || bounds.length === 0) {
        return {};
    }
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const bound of bounds) {
        for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis] ?? Infinity, read(bound.min, axis));
            max[axis] = Math.max(max[axis] ?? -Infinity, read(bound.max, axis));
        }
    }
    const center = [
        (min[0] + max[0]) * 0.5,
        (min[1] + max[1]) * 0.5,
        (min[2] + max[2]) * 0.5,
    ];
    const corners = [
        [min[0], min[1], min[2]],
        [min[0], min[1], max[2]],
        [min[0], max[1], min[2]],
        [min[0], max[1], max[2]],
        [max[0], min[1], min[2]],
        [max[0], min[1], max[2]],
        [max[0], max[1], min[2]],
        [max[0], max[1], max[2]],
    ];
    const radius = Math.max(...corners.map((corner) => Math.hypot(corner[0] - center[0], corner[1] - center[1], corner[2] - center[2])));
    return {
        localAabb: { min, max },
        localSphere: { center, radius },
    };
}
function read(value, index) {
    const item = value[index];
    if (item === undefined) {
        throw new RangeError(`Missing vector component ${index}.`);
    }
    return item;
}
//# sourceMappingURL=mesh-merge-bounds.js.map