export function createQueuedMaterialFrameResourceBuckets() {
    return { byFamily: new Map() };
}
export function resetQueuedMaterialFrameResourceBuckets(buckets) {
    buckets.byFamily.clear();
    return buckets;
}
export function appendQueuedMaterialFrameResourceBucket(buckets, family, resource) {
    const bucket = getOrCreateFamilyBucket(buckets, family);
    bucket.push(resource);
    return bucket;
}
export function getQueuedMaterialFrameResourceBucket(buckets, family) {
    return buckets.byFamily.get(family) ?? [];
}
export function createQueuedMaterialFrameResourceBucketSummary(buckets) {
    return [...buckets.byFamily.entries()]
        .sort(([a], [b]) => compareStrings(a, b))
        .map(([family, resources]) => ({
        family,
        itemCount: resources.length,
    }));
}
function getOrCreateFamilyBucket(buckets, family) {
    let bucket = buckets.byFamily.get(family);
    if (bucket === undefined) {
        bucket = [];
        buckets.byFamily.set(family, bucket);
    }
    return bucket;
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=queued-material-frame-resource-buckets.js.map