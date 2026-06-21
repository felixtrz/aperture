import { assetHandleKey } from "./handles.js";
import { ASSET_KINDS } from "./types.js";
export class AssetRegistry {
    #entries = new Map();
    register(handle, options = {}) {
        const key = assetHandleKey(handle);
        if (this.#entries.has(key)) {
            throw new Error(`Asset '${key}' is already registered.`);
        }
        const entry = {
            handle,
            kind: handle.kind,
            label: options.label ?? handle.id,
            status: "registered",
            version: 0,
            asset: null,
            dependencies: [...(options.dependencies ?? [])],
            diagnostics: [...(options.diagnostics ?? [])],
        };
        this.#entries.set(key, entry);
        return entry;
    }
    unregister(handle) {
        const key = assetHandleKey(handle);
        const entry = this.#entries.get(key);
        if (entry === undefined) {
            return undefined;
        }
        this.#entries.delete(key);
        return entry;
    }
    has(handle) {
        return this.#entries.has(assetHandleKey(handle));
    }
    get(handle) {
        return this.#entries.get(assetHandleKey(handle));
    }
    getStatus(handle) {
        return this.get(handle)?.status;
    }
    markLoading(handle) {
        return this.update(handle, {
            status: "loading",
            asset: null,
        });
    }
    markReady(handle, asset, diagnostics = []) {
        return this.update(handle, {
            status: "ready",
            asset,
            diagnostics,
        });
    }
    markFailed(handle, diagnostics) {
        return this.update(handle, {
            status: "failed",
            asset: null,
            diagnostics,
        });
    }
    list(filter = {}) {
        return [...this.#entries.values()].filter((entry) => {
            if (filter.kind !== undefined && entry.kind !== filter.kind) {
                return false;
            }
            if (filter.status !== undefined && entry.status !== filter.status) {
                return false;
            }
            return true;
        });
    }
    collectDiagnostics(handle) {
        if (handle !== undefined) {
            return [...(this.get(handle)?.diagnostics ?? [])];
        }
        return this.list().flatMap((entry) => [...entry.diagnostics]);
    }
    inspectDependencies(handle) {
        return {
            handleKey: assetHandleKey(handle),
            diagnostics: this.collectDependencyDiagnostics(handle),
        };
    }
    createManifestReport() {
        const byKind = emptyKindCounts();
        const byStatus = emptyStatusCounts();
        const dependencies = [];
        const diagnostics = [];
        for (const entry of this.list()) {
            byKind[entry.kind] += 1;
            byStatus[entry.status] += 1;
            for (const dependency of entry.dependencies) {
                dependencies.push({
                    from: assetHandleKey(entry.handle),
                    to: assetHandleKey(dependency),
                });
            }
            diagnostics.push(...this.collectDependencyDiagnostics(entry.handle));
        }
        return {
            total: this.#entries.size,
            byKind,
            byStatus,
            dependencies,
            diagnostics,
        };
    }
    update(handle, patch) {
        const current = this.get(handle);
        if (current === undefined) {
            throw new Error(`Asset '${assetHandleKey(handle)}' is not registered.`);
        }
        const next = {
            ...current,
            status: patch.status,
            version: current.version + 1,
            asset: patch.asset,
            diagnostics: patch.diagnostics === undefined
                ? current.diagnostics
                : [...patch.diagnostics],
        };
        this.#entries.set(assetHandleKey(handle), next);
        return next;
    }
    collectDependencyDiagnostics(handle) {
        const diagnostics = [];
        const rootKey = assetHandleKey(handle);
        const visit = (current, path) => {
            const currentEntry = this.get(current);
            if (currentEntry === undefined) {
                diagnostics.push({
                    code: "asset.dependencyMissing",
                    handleKey: rootKey,
                    dependencyKey: assetHandleKey(current),
                    path,
                    message: `Missing dependency '${assetHandleKey(current)}'.`,
                });
                return;
            }
            for (const dependency of currentEntry.dependencies) {
                const dependencyKey = assetHandleKey(dependency);
                const nextPath = [...path, dependencyKey];
                const dependencyEntry = this.get(dependency);
                if (path.includes(dependencyKey)) {
                    diagnostics.push({
                        code: "asset.dependencyCycle",
                        handleKey: rootKey,
                        dependencyKey,
                        path: nextPath,
                        message: `Circular dependency detected at '${dependencyKey}'.`,
                    });
                    continue;
                }
                if (dependencyEntry === undefined) {
                    diagnostics.push({
                        code: "asset.dependencyMissing",
                        handleKey: rootKey,
                        dependencyKey,
                        path: nextPath,
                        message: `Missing dependency '${dependencyKey}'.`,
                    });
                    continue;
                }
                if (dependencyEntry.status === "loading") {
                    diagnostics.push({
                        code: "asset.dependencyLoading",
                        handleKey: rootKey,
                        dependencyKey,
                        path: nextPath,
                        message: `Dependency '${dependencyKey}' is still loading.`,
                    });
                }
                if (dependencyEntry.status === "failed") {
                    diagnostics.push({
                        code: "asset.dependencyFailed",
                        handleKey: rootKey,
                        dependencyKey,
                        path: nextPath,
                        message: `Dependency '${dependencyKey}' failed.`,
                    });
                }
                visit(dependency, nextPath);
            }
        };
        visit(handle, [rootKey]);
        return diagnostics;
    }
}
function emptyKindCounts() {
    return Object.fromEntries(ASSET_KINDS.map((kind) => [kind, 0]));
}
function emptyStatusCounts() {
    return {
        registered: 0,
        loading: 0,
        ready: 0,
        failed: 0,
    };
}
//# sourceMappingURL=registry.js.map