import { assetHandleKey } from "./handles.js";
export class TypedAssetCollection {
    #registry;
    #kind;
    #createHandle;
    #idPrefix;
    #label;
    #dependencies;
    #nextId = 1;
    constructor(options) {
        this.#registry = options.registry;
        this.#kind = options.kind;
        this.#createHandle = options.createHandle;
        this.#idPrefix = options.idPrefix ?? options.kind;
        this.#label = options.label ?? (() => undefined);
        this.#dependencies = options.dependencies ?? (() => []);
    }
    get registry() {
        return this.#registry;
    }
    get kind() {
        return this.#kind;
    }
    register(options = {}) {
        const handle = this.resolveHandle(options);
        this.#registry.register(handle, this.toRegisterOptions(options));
        return handle;
    }
    add(asset, options = {}) {
        const handle = this.resolveHandle(options);
        const dependencies = mergeAssetHandles(this.#dependencies(asset), options.dependencies ?? []);
        const diagnostics = options.diagnostics ?? [];
        const label = options.label ?? this.#label(asset);
        this.#registry.register(handle, this.toRegisterOptions({
            ...(label !== undefined ? { label } : {}),
            dependencies,
            diagnostics,
        }));
        this.#registry.markReady(handle, asset, diagnostics);
        return handle;
    }
    has(handle) {
        this.assertHandleKind(handle);
        return this.#registry.has(handle);
    }
    unregister(handle) {
        this.assertHandleKind(handle);
        return this.#registry.unregister(handle);
    }
    get(handle) {
        this.assertHandleKind(handle);
        return this.#registry.get(handle);
    }
    getAsset(handle) {
        const entry = this.get(handle);
        return entry?.status === "ready" && entry.asset !== null
            ? entry.asset
            : undefined;
    }
    markLoading(handle) {
        this.assertHandleKind(handle);
        return this.#registry.markLoading(handle);
    }
    markReady(handle, asset, diagnostics) {
        this.assertHandleKind(handle);
        return diagnostics === undefined
            ? this.#registry.markReady(handle, asset)
            : this.#registry.markReady(handle, asset, diagnostics);
    }
    markFailed(handle, diagnostics) {
        this.assertHandleKind(handle);
        return this.#registry.markFailed(handle, diagnostics);
    }
    list(filter = {}) {
        return this.#registry.list({
            ...filter,
            kind: this.#kind,
        });
    }
    resolveHandle(options) {
        if (options.handle !== undefined) {
            this.assertHandleKind(options.handle);
            return options.handle;
        }
        if (options.id !== undefined) {
            return this.#createHandle(options.id);
        }
        return this.createAvailableHandle();
    }
    createAvailableHandle() {
        let handle = this.#createHandle(`${this.#idPrefix}-${this.#nextId}`);
        while (this.#registry.has(handle)) {
            this.#nextId += 1;
            handle = this.#createHandle(`${this.#idPrefix}-${this.#nextId}`);
        }
        this.#nextId += 1;
        return handle;
    }
    assertHandleKind(handle) {
        if (handle.kind !== this.#kind) {
            throw new RangeError(`Expected ${this.#kind} asset handle, received '${assetHandleKey(handle)}'.`);
        }
    }
    toRegisterOptions(options) {
        return {
            ...(options.label !== undefined ? { label: options.label } : {}),
            ...(options.dependencies !== undefined
                ? { dependencies: options.dependencies }
                : {}),
            ...(options.diagnostics !== undefined
                ? { diagnostics: options.diagnostics }
                : {}),
        };
    }
}
function mergeAssetHandles(first, second) {
    if (first.length === 0) {
        return [...second];
    }
    if (second.length === 0) {
        return [...first];
    }
    const handles = [];
    const seen = new Set();
    for (const handle of [...first, ...second]) {
        const key = assetHandleKey(handle);
        if (!seen.has(key)) {
            seen.add(key);
            handles.push(handle);
        }
    }
    return handles;
}
//# sourceMappingURL=collections.js.map