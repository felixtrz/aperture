import { assetHandleKey, } from "@aperture-engine/simulation";
export function prepareRenderAsset(options) {
    const assetKey = assetHandleKey(options.handle);
    const entry = options.registry.get(options.handle);
    if (entry === undefined) {
        const unload = unloadPreparedRenderAsset({
            adapter: options.adapter,
            store: options.store,
            handle: options.handle,
        });
        return skippedReport(assetKey, {
            code: "renderAsset.sourceMissing",
            message: `Source asset '${assetKey}' is not registered.`,
            severity: "warning",
            assetKey,
        }, unload.diagnostics);
    }
    if (entry.status !== "ready" || entry.asset === null) {
        const unload = unloadPreparedRenderAsset({
            adapter: options.adapter,
            store: options.store,
            handle: options.handle,
        });
        return skippedReport(assetKey, {
            code: `renderAsset.source.${entry.status}`,
            message: `Source asset '${assetKey}' is ${entry.status}.`,
            severity: entry.status === "failed" ? "error" : "warning",
            assetKey,
        }, unload.diagnostics);
    }
    const dependencyState = createRenderAssetDependencyState(options.registry, entry);
    const previous = options.store.get(options.handle);
    if (previous !== undefined &&
        previous.sourceVersion === entry.version &&
        previous.dependencyState.key === dependencyState.key) {
        return {
            outcome: "unchanged",
            assetKey,
            entry: previous,
            diagnostics: [],
        };
    }
    const result = options.adapter.prepare({
        registry: options.registry,
        handle: options.handle,
        assetKey,
        source: entry.asset,
        sourceVersion: entry.version,
        dependencyState,
        previous,
    });
    if (result.status === "prepared") {
        const update = options.store.upsert({
            handle: options.handle,
            family: options.adapter.family,
            sourceVersion: entry.version,
            dependencyState,
            prepared: result.prepared,
            ...(result.diagnostics !== undefined
                ? { diagnostics: result.diagnostics }
                : {}),
        });
        return {
            outcome: "prepared",
            assetKey,
            action: update.action,
            entry: update.entry,
            diagnostics: result.diagnostics ?? [],
        };
    }
    const unload = unloadPreparedRenderAsset({
        adapter: options.adapter,
        store: options.store,
        handle: options.handle,
    });
    return {
        outcome: result.status,
        assetKey,
        diagnostics: [...result.diagnostics, ...unload.diagnostics],
    };
}
export function unloadPreparedRenderAsset(options) {
    const assetKey = assetHandleKey(options.handle);
    const removal = options.store.remove(options.handle);
    if (!removal.removed || removal.entry === undefined) {
        return { removed: false, assetKey, diagnostics: [] };
    }
    const unload = options.adapter.unload?.({
        handle: options.handle,
        assetKey,
        prepared: removal.entry,
    });
    return {
        removed: true,
        assetKey,
        entry: removal.entry,
        diagnostics: unload?.diagnostics ?? [],
    };
}
export function createRenderAssetDependencyState(registry, entry) {
    const diagnostics = registry.inspectDependencies(entry.handle).diagnostics;
    const dependencyStatuses = entry.dependencies.map((dependency) => {
        const dependencyEntry = registry.get(dependency);
        return `${assetHandleKey(dependency)}:${dependencyEntry?.status ?? "missing"}:${dependencyEntry?.version ?? -1}`;
    });
    return {
        key: [...dependencyStatuses, ...diagnostics.map(diagnosticKey)]
            .sort()
            .join("|"),
        ready: diagnostics.length === 0,
        dependencies: [...entry.dependencies],
        diagnostics,
    };
}
function skippedReport(assetKey, diagnostic, extraDiagnostics = []) {
    return {
        outcome: "skipped",
        assetKey,
        diagnostics: [diagnostic, ...extraDiagnostics],
    };
}
function diagnosticKey(diagnostic) {
    return `${diagnostic.code}:${diagnostic.dependencyKey}:${diagnostic.path.join(">")}`;
}
//# sourceMappingURL=preparation-core.js.map