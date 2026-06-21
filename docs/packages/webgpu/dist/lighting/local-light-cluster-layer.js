export function normalizeLayerMask(layerMask) {
    if (layerMask === undefined || !Number.isFinite(layerMask)) {
        return null;
    }
    const normalized = Math.trunc(layerMask);
    return normalized === 0 ? null : normalized;
}
export function lightMatchesLayer(light, layerMask) {
    return layerMask === null || (light.layerMask & layerMask) !== 0;
}
//# sourceMappingURL=local-light-cluster-layer.js.map