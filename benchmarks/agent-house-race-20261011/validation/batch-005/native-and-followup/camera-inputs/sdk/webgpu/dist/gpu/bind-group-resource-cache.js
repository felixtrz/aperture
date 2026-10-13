export function createBindGroupResourceCache() {
    return {
        resources: new Map(),
        created: 0,
        reused: 0,
    };
}
export function resetBindGroupResourceCache(cache) {
    cache.resources.clear();
    cache.created = 0;
    cache.reused = 0;
    return cache;
}
export function bindGroupResourceCacheReport(cache) {
    return {
        created: cache.created,
        reused: cache.reused,
        cached: cache.resources.size,
    };
}
export function readCachedBindGroupResource(cache, key) {
    if (cache === undefined) {
        return null;
    }
    const resource = cache.resources.get(key);
    if (resource === undefined) {
        return null;
    }
    cache.reused += 1;
    return resource;
}
export function writeCachedBindGroupResource(cache, key, resource) {
    if (cache === undefined) {
        return;
    }
    cache.resources.set(key, resource);
    cache.created += 1;
}
//# sourceMappingURL=bind-group-resource-cache.js.map