export function spatialEntryMatches(entry, entity, options, sourceKind) {
    if (entry.visible === false || options.filter?.(entity) === false) {
        return false;
    }
    if (entry.pickable?.enabled === false) {
        return false;
    }
    if (sourceKind === "mesh" &&
        entry.pickable?.precision !== undefined &&
        entry.pickable.precision !== "visual-mesh") {
        return false;
    }
    return (spatialLayerMatches(entry.layerMask, options.layerMask) &&
        (entry.pickable?.layerMask === undefined ||
            spatialLayerMatches(entry.pickable.layerMask, options.layerMask)));
}
function spatialLayerMatches(objectLayerMask, queryLayerMask) {
    return ((((objectLayerMask ?? 0x00000001) >>> 0) &
        ((queryLayerMask ?? 0xffffffff) >>> 0)) !==
        0);
}
//# sourceMappingURL=filters.js.map