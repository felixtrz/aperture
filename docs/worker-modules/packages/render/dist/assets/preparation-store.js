import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export class PreparedRenderAssetStore {
    #entries = new Map();
    get size() {
        return this.#entries.size;
    }
    has(handle) {
        return this.#entries.has(assetHandleKey(handle));
    }
    get(handle) {
        return this.#entries.get(assetHandleKey(handle));
    }
    list() {
        return [...this.#entries.values()].sort((a, b) => a.assetKey.localeCompare(b.assetKey));
    }
    upsert(input) {
        const assetKey = assetHandleKey(input.handle);
        const action = this.#entries.has(assetKey) ? "updated" : "created";
        const entry = {
            handle: input.handle,
            assetKey,
            family: input.family,
            sourceVersion: input.sourceVersion,
            dependencyState: input.dependencyState,
            prepared: input.prepared,
            diagnostics: [...(input.diagnostics ?? [])],
        };
        this.#entries.set(assetKey, entry);
        return { action, entry };
    }
    remove(handle) {
        const assetKey = assetHandleKey(handle);
        const entry = this.#entries.get(assetKey);
        if (entry === undefined) {
            return { removed: false };
        }
        this.#entries.delete(assetKey);
        return { removed: true, entry };
    }
    clear() {
        this.#entries.clear();
    }
}
//# sourceMappingURL=preparation-store.js.map