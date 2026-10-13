export class WebGpuBindGroupLayoutCache {
    #layouts = new Map();
    get size() {
        return this.#layouts.size;
    }
    has(input) {
        return this.#layouts.has(resolveKey(input));
    }
    clear() {
        this.#layouts.clear();
    }
    getOrCreate(request) {
        const key = createWebGpuBindGroupLayoutCacheKey(request.descriptor);
        const existing = this.#layouts.get(key);
        if (existing !== undefined) {
            return { ok: true, status: "hit", key, layout: existing };
        }
        if (request.device.createBindGroupLayout === undefined) {
            return {
                ok: false,
                reason: "create-bind-group-layout-unavailable",
                key,
                message: "WebGPU device cannot create bind group layouts.",
            };
        }
        const layout = request.device.createBindGroupLayout(request.descriptor);
        this.#layouts.set(key, layout);
        return { ok: true, status: "miss", key, layout };
    }
}
export function createWebGpuBindGroupLayoutCacheKey(descriptor) {
    return JSON.stringify({
        entries: descriptor.entries
            .map((entry) => normalizedEntry(entry))
            .sort(compareNormalizedEntries),
    });
}
function resolveKey(input) {
    return typeof input === "string"
        ? input
        : createWebGpuBindGroupLayoutCacheKey(input);
}
function normalizedEntry(entry) {
    return stableDescriptorValue(entry);
}
function compareNormalizedEntries(a, b) {
    const bindingDelta = numberValue(a.binding) - numberValue(b.binding);
    if (bindingDelta !== 0) {
        return bindingDelta;
    }
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
}
function stableDescriptorValue(value) {
    if (Array.isArray(value)) {
        return value.map(stableDescriptorValue);
    }
    if (value === null || typeof value !== "object") {
        return value;
    }
    const object = value;
    const normalized = {};
    for (const key of Object.keys(object).sort()) {
        if (key === "label" || object[key] === undefined) {
            continue;
        }
        normalized[key] = stableDescriptorValue(object[key]);
    }
    return normalized;
}
function numberValue(value) {
    return typeof value === "number" ? value : 0;
}
//# sourceMappingURL=bind-group-layout-cache.js.map