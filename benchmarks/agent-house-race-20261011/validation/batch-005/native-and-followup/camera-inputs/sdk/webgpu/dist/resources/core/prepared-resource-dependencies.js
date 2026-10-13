export function capturePreparedResourceDependencies(...candidates) {
    return candidates.flatMap(([cache, entry]) => entry === null || entry === undefined ? [] : [{ cache, entry }]);
}
/**
 * A GPU cache hit is also a use of its prepared dependencies. An idle-retired
 * or superseded alias cannot be revived by a stale GPU resource reference:
 * the caller must take its ordinary preparation path instead.
 */
export function touchPreparedResourceDependencies(dependencies, frame) {
    if (!preparedResourceDependenciesAreLive(dependencies))
        return false;
    for (const { entry } of dependencies)
        entry.lastUsedFrame = Math.max(entry.lastUsedFrame, frame);
    return true;
}
export function preparedResourceDependenciesAreLive(dependencies) {
    return !(dependencies === undefined ||
        dependencies.some(({ cache, entry }) => cache.resources.get(entry.cacheKey) !== entry));
}
//# sourceMappingURL=prepared-resource-dependencies.js.map