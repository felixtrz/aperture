export async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            const item = items[index];
            if (item !== undefined) {
                results[index] = await mapper(item);
            }
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}
export function normalizeConcurrency(value, fallback) {
    if (value === undefined || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(1, Math.floor(value));
}
export function createMergedImageDataResolver(input) {
    return (resolverInput) => {
        const decoded = input.decodedImages.get(resolverInput.imageIndex);
        if (decoded !== undefined) {
            return decoded;
        }
        return input.fallback?.(resolverInput) ?? null;
    };
}
//# sourceMappingURL=gltf-uri-image-merge.js.map