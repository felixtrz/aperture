export function mergeExternalBufferBytes(provided, fetched) {
    if (provided === undefined || provided.size === 0) {
        return fetched;
    }
    const merged = new Map(provided);
    for (const [bufferIndex, bytes] of fetched.entries()) {
        if (!merged.has(bufferIndex)) {
            merged.set(bufferIndex, bytes);
        }
    }
    return merged;
}
export function mergeExternalImageBytes(provided, fetched) {
    if (provided === undefined || provided.size === 0) {
        return fetched;
    }
    const merged = new Map(provided);
    for (const [imageIndex, bytes] of fetched.entries()) {
        if (!merged.has(imageIndex)) {
            merged.set(imageIndex, bytes);
        }
    }
    return merged;
}
//# sourceMappingURL=glb-uri-external-merge.js.map